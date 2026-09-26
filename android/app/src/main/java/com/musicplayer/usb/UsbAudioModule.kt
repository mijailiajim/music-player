package com.musicplayer.usb

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.UsbManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.storage.StorageManager
import android.os.storage.StorageVolume
import android.provider.Settings
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener
import java.io.File

/**
 * Puente nativo del reproductor:
 *  - getVolumes: volúmenes de almacenamiento (el pendrive OTG aparece como
 *    volumen extraíble no primario, p. ej. /storage/ABCD-1234).
 *  - listDir: listado de archivos de una ruta.
 *  - hasStorageAccess / requestStorageAccess: permiso de lectura (All Files
 *    Access en Android 11+, READ_EXTERNAL_STORAGE antes).
 *  - adjustVolume: volumen multimedia del sistema.
 *  - canAutoOpen / requestAutoOpen: permiso para abrirse sola al conectar el
 *    pendrive ("Mostrar sobre otras apps" en Android 10+).
 *  - closeApp: cerrar la app (al sacar el pendrive).
 *  - Evento "usbStorageChanged": montaje/expulsión de medios y conexión USB.
 *  - Evento "remoteKey": teclas del control (y el clic del puntero, como OK)
 *    reenviadas por MainActivity.
 */
class UsbAudioModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

  private var receiver: BroadcastReceiver? = null

  override fun getName(): String = NAME

  override fun initialize() {
    super.initialize()
    val r = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        val params = Arguments.createMap()
        params.putString("action", intent?.action ?: "")
        params.putString("data", intent?.dataString ?: "")
        emit("usbStorageChanged", params)
      }
    }
    receiver = r
    // ACTION_MEDIA_* exige el esquema "file"; las acciones USB no llevan
    // esquema, por eso van en un filtro separado.
    val mediaFilter = IntentFilter().apply {
      addAction(Intent.ACTION_MEDIA_MOUNTED)
      addAction(Intent.ACTION_MEDIA_UNMOUNTED)
      addAction(Intent.ACTION_MEDIA_EJECT)
      addAction(Intent.ACTION_MEDIA_REMOVED)
      addAction(Intent.ACTION_MEDIA_BAD_REMOVAL)
      addDataScheme("file")
    }
    val usbFilter = IntentFilter().apply {
      addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
      addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
    }
    registerCompat(r, mediaFilter)
    registerCompat(r, usbFilter)
  }

  override fun invalidate() {
    receiver?.let {
      try {
        ctx.unregisterReceiver(it)
      } catch (_: Exception) {}
    }
    receiver = null
    super.invalidate()
  }

  private fun registerCompat(r: BroadcastReceiver, filter: IntentFilter) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      // Solo se esperan broadcasts del sistema; EXPORTED garantiza la entrega
      // en todos los OEM y un broadcast falsificado solo provocaría un
      // re-escaneo inofensivo.
      ctx.registerReceiver(r, filter, Context.RECEIVER_EXPORTED)
    } else {
      ctx.registerReceiver(r, filter)
    }
  }

  private fun emit(event: String, params: WritableMap) {
    if (!ctx.hasActiveReactInstance()) return
    ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(event, params)
  }

  @ReactMethod
  fun getVolumes(promise: Promise) {
    try {
      val sm = ctx.getSystemService(Context.STORAGE_SERVICE) as StorageManager
      val result = Arguments.createArray()
      for (volume in sm.storageVolumes) {
        val path = volumePath(volume) ?: continue
        val map = Arguments.createMap()
        map.putString("path", path)
        map.putString(
            "description",
            try {
              volume.getDescription(ctx) ?: "USB"
            } catch (_: Exception) {
              "USB"
            })
        map.putBoolean("removable", volume.isRemovable)
        map.putBoolean("primary", volume.isPrimary)
        map.putString("state", volume.state)
        result.pushMap(map)
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("volumes_error", e)
    }
  }

  private fun volumePath(volume: StorageVolume): String? =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        volume.directory?.absolutePath
      } else {
        try {
          volume.javaClass.getMethod("getPath").invoke(volume) as? String
        } catch (_: Exception) {
          null
        }
      }

  @ReactMethod
  fun listDir(path: String, promise: Promise) {
    Thread {
      try {
        val children = File(path).listFiles()
        val result = Arguments.createArray()
        if (children != null) {
          for (file in children) {
            val map = Arguments.createMap()
            map.putString("name", file.name)
            map.putString("path", file.absolutePath)
            map.putBoolean("isDirectory", file.isDirectory)
            result.pushMap(map)
          }
        }
        promise.resolve(result)
      } catch (e: Exception) {
        promise.reject("listdir_error", e)
      }
    }
        .start()
  }

  @ReactMethod
  fun hasStorageAccess(promise: Promise) {
    val granted =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          Environment.isExternalStorageManager()
        } else {
          ctx.checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE) ==
              PackageManager.PERMISSION_GRANTED
        }
    promise.resolve(granted)
  }

  @ReactMethod
  fun requestStorageAccess(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        // El permiso se otorga en Ajustes; la app vuelve a comprobarlo al
        // volver al primer plano.
        val intent =
            Intent(
                Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                Uri.parse("package:" + ctx.packageName))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          ctx.startActivity(intent)
        } catch (_: Exception) {
          val fallback = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION)
          fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          ctx.startActivity(fallback)
        }
        promise.resolve(false)
      } else {
        val activity: Activity? = ctx.currentActivity
        if (activity is PermissionAwareActivity) {
          activity.requestPermissions(
              arrayOf(android.Manifest.permission.READ_EXTERNAL_STORAGE),
              REQUEST_STORAGE,
              PermissionListener { requestCode, _, grantResults ->
                if (requestCode != REQUEST_STORAGE) {
                  false
                } else {
                  promise.resolve(
                      grantResults.isNotEmpty() &&
                          grantResults[0] == PackageManager.PERMISSION_GRANTED)
                  true
                }
              })
        } else {
          promise.resolve(false)
        }
      }
    } catch (e: Exception) {
      promise.reject("permission_error", e)
    }
  }

  @ReactMethod
  fun canAutoOpen(promise: Promise) {
    promise.resolve(UsbAutoOpenReceiver.canOpenFromBackground(ctx))
  }

  /** Abre el ajuste "Mostrar sobre otras apps"; se re-verifica al volver. */
  @ReactMethod
  fun requestAutoOpen() {
    val settings =
        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + ctx.packageName))
    settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      ctx.startActivity(settings)
    } catch (_: Exception) {
      // Algunos equipos (Android Go / TV) no tienen esa pantalla.
      val details =
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName))
      details.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        ctx.startActivity(details)
      } catch (_: Exception) {}
    }
  }

  /**
   * Cierra la app (al sacar el pendrive): termina la actividad y la saca de
   * recientes. Al quitarse la tarea, react-native-track-player detiene la
   * música, quita la notificación y termina el proceso
   * (StopPlaybackAndRemoveNotification). Al conectar el pendrive se abre sola.
   */
  @ReactMethod
  fun closeApp() {
    val activity = ctx.currentActivity ?: return
    activity.runOnUiThread { activity.finishAndRemoveTask() }
  }

  @ReactMethod
  fun adjustVolume(direction: Int) {
    try {
      val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      am.adjustStreamVolume(
          AudioManager.STREAM_MUSIC,
          if (direction >= 0) AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER,
          AudioManager.FLAG_SHOW_UI)
    } catch (_: Exception) {}
  }

  // Requeridos por NativeEventEmitter aunque se emita vía RCTDeviceEventEmitter.
  @ReactMethod fun addListener(eventName: String?) {}

  @ReactMethod fun removeListeners(count: Int) {}

  companion object {
    const val NAME = "UsbAudio"
    private const val REQUEST_STORAGE = 4711

    /**
     * Teclas que la app usa. Se atrapan en MainActivity.dispatchKeyEvent,
     * ANTES que la interfaz y que el sistema, y se consumen (al apretar y al
     * soltar):
     *  - OK (todas las teclas de confirmación): si no, Android las convierte en
     *    un clic sobre el botón enfocado de la pantalla (⏮) sin pasar por la app.
     *  - Flechas: la app necesita saber cuándo se SUELTAN (mantener ▲/▼ recorre
     *    la lista; mantener ◀/▶ adelanta/atrasa la canción).
     *  - Re Pág / Av Pág y Home/retorno (BACK): navegan las carpetas. Así BACK
     *    tampoco cierra la app.
     *  - Multimedia y canal.
     */
    private val USED_KEYS =
        setOf(
            KeyEvent.KEYCODE_DPAD_UP,
            KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_LEFT,
            KeyEvent.KEYCODE_DPAD_RIGHT,
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_NUMPAD_ENTER,
            KeyEvent.KEYCODE_SPACE,
            KeyEvent.KEYCODE_BUTTON_SELECT,
            KeyEvent.KEYCODE_BUTTON_A,
            KeyEvent.KEYCODE_PAGE_UP,
            KeyEvent.KEYCODE_PAGE_DOWN,
            KeyEvent.KEYCODE_BACK,
            KeyEvent.KEYCODE_HEADSETHOOK,
            KeyEvent.KEYCODE_MEDIA_PLAY,
            KeyEvent.KEYCODE_MEDIA_PAUSE,
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
            KeyEvent.KEYCODE_MEDIA_STOP,
            KeyEvent.KEYCODE_MEDIA_NEXT,
            KeyEvent.KEYCODE_MEDIA_PREVIOUS,
            KeyEvent.KEYCODE_MEDIA_FAST_FORWARD,
            KeyEvent.KEYCODE_MEDIA_REWIND,
            KeyEvent.KEYCODE_CHANNEL_UP,
            KeyEvent.KEYCODE_CHANNEL_DOWN)

    /**
     * Botones desactivados a propósito: se consumen y no hacen nada. Micrófono
     * (búsqueda / asistente de voz), DEL y encendido. OJO: algunas de estas
     * teclas (POWER, y en muchos equipos el asistente) las atiende Android
     * antes que cualquier app: esas nunca llegan acá y no se pueden bloquear.
     */
    private val DISABLED_KEYS =
        setOf(
            KeyEvent.KEYCODE_SEARCH,
            KeyEvent.KEYCODE_VOICE_ASSIST,
            KeyEvent.KEYCODE_ASSIST,
            KeyEvent.KEYCODE_DEL,
            KeyEvent.KEYCODE_FORWARD_DEL,
            KeyEvent.KEYCODE_POWER,
            KeyEvent.KEYCODE_SLEEP,
            KeyEvent.KEYCODE_SOFT_SLEEP,
            KeyEvent.KEYCODE_WAKEUP,
            KeyEvent.KEYCODE_TV_POWER,
            KeyEvent.KEYCODE_STB_POWER,
            KeyEvent.KEYCODE_AVR_POWER)

    /** Se apretó el botón del puntero (para emparejar el soltar). */
    private var pointerDown = false

    /**
     * Desde MainActivity.dispatchKeyEvent. Devuelve true (consume) las teclas
     * que la app usa —que además se avisan a JS, al apretar y al soltar— y las
     * desactivadas, que no hacen nada. El resto (volumen, Menú…) sigue su
     * comportamiento normal en el sistema.
     */
    fun interceptKey(activity: Activity, event: KeyEvent): Boolean {
      val keyCode = event.keyCode
      if (keyCode in DISABLED_KEYS) return true
      if (keyCode !in USED_KEYS) return false
      if (event.action == KeyEvent.ACTION_DOWN || event.action == KeyEvent.ACTION_UP) {
        emitKey(activity, keyCode, event.action, event.repeatCount)
      }
      return true
    }

    /**
     * Desde MainActivity.dispatchTouchEvent / dispatchGenericMotionEvent: el
     * puntero del air mouse (el botón del cursor lo activa). Dentro de la app
     * no hace nada —sus movimientos se ignoran y el puntero no se ve— salvo el
     * clic, que en modo cursor es el OK del control: se avisa a JS como OK.
     * Los toques con el dedo no se tocan.
     */
    fun interceptPointer(activity: Activity, event: MotionEvent): Boolean {
      if (!event.isFromSource(InputDevice.SOURCE_MOUSE)) return false
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN ->
            if ((event.buttonState and MotionEvent.BUTTON_SECONDARY) == 0) {
              pointerDown = true
              emitKey(activity, KeyEvent.KEYCODE_ENTER, KeyEvent.ACTION_DOWN, 0)
            }
        MotionEvent.ACTION_UP,
        MotionEvent.ACTION_CANCEL ->
            if (pointerDown) {
              pointerDown = false
              emitKey(activity, KeyEvent.KEYCODE_ENTER, KeyEvent.ACTION_UP, 0)
            }
      }
      return true
    }

    /** Emite "remoteKey" a JS; false si React todavía no está listo. */
    private fun emitKey(activity: Activity, keyCode: Int, action: Int, repeatCount: Int): Boolean {
      val app = activity.application as? ReactApplication ?: return false
      val reactContext =
          app.reactNativeHost.reactInstanceManager.currentReactContext ?: return false
      val params = Arguments.createMap()
      params.putInt("keyCode", keyCode)
      params.putInt("repeatCount", repeatCount)
      params.putString("action", if (action == KeyEvent.ACTION_UP) "up" else "down")
      reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("remoteKey", params)
      return true
    }
  }
}

package com.musicplayer

import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.PointerIcon
import android.view.View
import android.view.ViewGroup
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.musicplayer.power.KeepAwake
import com.musicplayer.power.ScreenOnGuard
import com.musicplayer.usb.UsbAudioModule

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MusicPlayer"

  /** Si Power apaga la pantalla con la app en uso, la vuelve a encender. */
  private val screenOnGuard = ScreenOnGuard(this)

  /** Vista invisible que tiene siempre el foco (ver onWindowFocusChanged). */
  private lateinit var keyFocus: View

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Keep awake: la app es la pantalla del reproductor mientras se usa con el
    // control remoto, así que mientras está en uso la pantalla nunca se apaga.
    KeepAwake.keepScreenOn(this)
    screenOnGuard.start()
    // Tampoco se ve el puntero del air mouse dentro de la app.
    window.decorView.pointerIcon = PointerIcon.getSystemIcon(this, PointerIcon.TYPE_NULL)

    keyFocus =
        View(this).apply {
          isFocusable = true
          isFocusableInTouchMode = true
          importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            defaultFocusHighlightEnabled = false
          }
        }
    addContentView(keyFocus, ViewGroup.LayoutParams(1, 1))
    keyFocus.requestFocus()
  }

  // Después de tocar la pantalla (p. ej. volver a la app desde recientes)
  // Android queda en "modo táctil" y usa la primera tecla del control solo para
  // salir de ese modo, sin pasarla a la app. Con el foco siempre en keyFocus
  // (que puede tenerlo también en modo táctil) las teclas llegan siempre.
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus && ::keyFocus.isInitialized) keyFocus.requestFocus()
  }

  override fun onResume() {
    super.onResume()
    screenOnGuard.onResume()
  }

  override fun onUserLeaveHint() {
    screenOnGuard.onUserLeaveHint()
    super.onUserLeaveHint()
  }

  override fun onPause() {
    screenOnGuard.onPause()
    super.onPause()
  }

  override fun onDestroy() {
    screenOnGuard.stop()
    super.onDestroy()
  }

  // Antes que nada (antes que el botón enfocado de la pantalla y que el
  // sistema) pasan por acá las teclas: las que la app usa (OK, flechas, Pág,
  // Home/retorno, multimedia) se avisan a JS y se consumen; las desactivadas
  // (micrófono, DEL, Power) se consumen sin hacer nada.
  override fun dispatchKeyEvent(event: KeyEvent): Boolean =
      UsbAudioModule.interceptKey(this, event) || super.dispatchKeyEvent(event)

  // El puntero del air mouse (modo cursor) no hace nada en la app; su clic
  // funciona como el OK del control. Los toques con el dedo no cambian.
  override fun dispatchTouchEvent(event: MotionEvent): Boolean =
      UsbAudioModule.interceptPointer(this, event) || super.dispatchTouchEvent(event)

  override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean =
      UsbAudioModule.interceptPointer(this, event) || super.dispatchGenericMotionEvent(event)

  // Red de seguridad del "atrás": si llega a React Native y nadie lo atiende
  // (p. ej. mientras JS todavía carga), Android cerraría la app; acá no hace
  // nada. Normalmente lo atiende la app: dispatchKeyEvent o BackHandler.
  override fun invokeDefaultOnBackPressed() {}

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

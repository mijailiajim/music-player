package com.musicplayer

import android.os.Bundle
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.PointerIcon
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.musicplayer.power.KeepAwake
import com.musicplayer.usb.UsbAudioModule

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MusicPlayer"

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Keep awake: la app es la pantalla del reproductor mientras se usa con el
    // control remoto, así que la pantalla no se apaga sola.
    KeepAwake.keepScreenOn(this)
    // Tampoco se ve el puntero del air mouse dentro de la app.
    window.decorView.pointerIcon = PointerIcon.getSystemIcon(this, PointerIcon.TYPE_NULL)
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

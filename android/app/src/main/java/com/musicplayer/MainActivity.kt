package com.musicplayer

import android.os.Bundle
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.PointerIcon
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.musicplayer.usb.UsbAudioModule

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MusicPlayer"

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // La app es la pantalla del reproductor mientras se usa con control
    // remoto: la pantalla no debe apagarse sola.
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    // Tampoco se ve el puntero del air mouse dentro de la app.
    window.decorView.pointerIcon = PointerIcon.getSystemIcon(this, PointerIcon.TYPE_NULL)
  }

  // Antes que nada (antes que el botón enfocado de la pantalla y que el
  // sistema) pasan por acá todas las teclas: se avisan a JS y se consumen las
  // que la app usa (OK, flechas, Pág, Home/retorno, multimedia) o desactiva.
  override fun dispatchKeyEvent(event: KeyEvent): Boolean =
      UsbAudioModule.interceptKey(this, event) || super.dispatchKeyEvent(event)

  // El puntero del air mouse (modo cursor) no hace nada en la app; su clic
  // funciona como el OK del control. Los toques con el dedo no cambian.
  override fun dispatchTouchEvent(event: MotionEvent): Boolean =
      UsbAudioModule.interceptPointer(this, event) || super.dispatchTouchEvent(event)

  override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean =
      UsbAudioModule.interceptPointer(this, event) || super.dispatchGenericMotionEvent(event)

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

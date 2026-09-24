package com.musicplayer

import android.os.Bundle
import android.view.KeyEvent
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
  }

  // Teclas de controles remotos Bluetooth. Todas se reenvían a JS para la línea
  // de señales, pero solo se consumen las del control (D-pad, OK, multimedia):
  // volumen, Back y Menú siguen su comportamiento normal en el sistema.
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (UsbAudioModule.handleRemoteKey(this, keyCode, event)) {
      return true
    }
    return super.onKeyDown(keyCode, event)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

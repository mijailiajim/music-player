package com.musicplayer.power

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager

/**
 * Actividad invisible del keep awake: al mostrarse enciende la pantalla
 * (turnScreenOn, también encima de la pantalla de bloqueo) y se cierra apenas
 * tiene el foco, así queda a la vista la app. Es la vía que Android recomienda
 * para encender la pantalla; ScreenOnGuard la abre si Power la apagó con la
 * app en uso.
 */
class ScreenOnActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
              WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    // Por si nunca recibe el foco, no queda abierta.
    handler.postDelayed({ finish() }, MAX_OPEN_MS)
  }

  // Tiene que llegar a mostrarse (eso enciende la pantalla): se cierra recién
  // cuando tiene el foco, no en onResume.
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) finish()
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    super.onDestroy()
  }

  private companion object {
    const val MAX_OPEN_MS = 3_000L
  }
}

package com.musicplayer.power

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.SystemClock

/**
 * Keep awake de la pantalla frente al botón de encendido: Android no deja que
 * una app bloquee Power, así que si la pantalla se apaga mientras la app está
 * en uso, se vuelve a encender enseguida (y se ve la app, que se muestra encima
 * de la pantalla de bloqueo).
 *
 * "En uso": la app está al frente o se acaba de pausar sin que el usuario haya
 * salido de ella. Al apagarse la pantalla Android también pausa la app, a veces
 * antes de avisar que se apagó. Si en cambio se sale de la app (Inicio,
 * recientes), la pantalla se apaga normalmente.
 */
class ScreenOnGuard(private val activity: Activity) {
  private var resumed = false
  private var userLeft = false
  private var pausedByScreenOff = false
  private var pausedAt: Long? = null
  private var registered = false

  private val screenOff =
      object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          if (intent.action == Intent.ACTION_SCREEN_OFF && inUse()) {
            KeepAwake.wakeScreen(activity)
          }
        }
      }

  fun start() {
    if (registered) return
    val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      // Solo lo manda el sistema (broadcast protegido).
      activity.registerReceiver(screenOff, filter, Context.RECEIVER_EXPORTED)
    } else {
      activity.registerReceiver(screenOff, filter)
    }
    registered = true
  }

  fun stop() {
    if (!registered) return
    registered = false
    try {
      activity.unregisterReceiver(screenOff)
    } catch (_: IllegalArgumentException) {}
  }

  fun onResume() {
    resumed = true
    userLeft = false
    pausedByScreenOff = false
  }

  /** El usuario salió de la app (Inicio, recientes u otra app). */
  fun onUserLeaveHint() {
    userLeft = true
  }

  fun onPause() {
    resumed = false
    pausedAt = SystemClock.elapsedRealtime()
    pausedByScreenOff = !KeepAwake.isScreenOn(activity)
  }

  private fun inUse(): Boolean {
    if (resumed) return true
    if (userLeft) return false
    val justPaused = pausedAt?.let { SystemClock.elapsedRealtime() - it < JUST_PAUSED_MS } == true
    return pausedByScreenOff || justPaused
  }

  private companion object {
    const val JUST_PAUSED_MS = 3_000L
  }
}

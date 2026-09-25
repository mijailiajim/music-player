package com.musicplayer.power

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build

/**
 * Keep awake de la pantalla frente al botón de encendido: Android no deja que
 * una app bloquee Power, así que si la pantalla se apaga mientras la app está
 * en uso, se vuelve a encender enseguida (y se ve la app, que se muestra encima
 * de la pantalla de bloqueo).
 *
 * "En uso": la app está al frente. Al apagarse la pantalla Android también
 * pausa la app, a veces antes de avisar que se apagó: por eso también cuenta
 * si se pausó justamente porque se apagó la pantalla. Si en cambio se sale de
 * la app (Inicio), la pantalla se apaga normalmente.
 */
class ScreenOnGuard(private val activity: Activity) {
  private var resumed = false
  private var pausedByScreenOff = false
  private var registered = false

  private val screenOff =
      object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          if (intent.action == Intent.ACTION_SCREEN_OFF && (resumed || pausedByScreenOff)) {
            KeepAwake.wakeScreen(context)
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
    pausedByScreenOff = false
  }

  fun onPause() {
    resumed = false
    pausedByScreenOff = !KeepAwake.isScreenOn(activity)
  }
}

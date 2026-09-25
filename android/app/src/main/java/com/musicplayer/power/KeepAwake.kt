package com.musicplayer.power

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.os.PowerManager
import android.view.WindowManager

/**
 * Keep awake: que el equipo no se duerma mientras se usa la app.
 *  - Pantalla: mientras se ve la app, la pantalla no se apaga ni se oscurece
 *    sola (FLAG_KEEP_SCREEN_ON; Android deja de aplicarlo cuando la app ya no
 *    está a la vista).
 *  - Reproducción: mientras suena música, el procesador no se duerme aunque se
 *    apague la pantalla (p. ej. con Power): la música no se corta. Lo pide JS
 *    según el estado del reproductor (PlaybackKeepAwake) y lo suelta en pausa.
 */
object KeepAwake {
  private const val TAG = "MusicaUSB:reproduccion"

  private var playbackLock: PowerManager.WakeLock? = null

  fun keepScreenOn(activity: Activity) {
    activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  // Sin tiempo límite a propósito (como el wake mode de ExoPlayer): se suelta
  // al pausar o detener, y Android lo libera solo si el proceso termina.
  @SuppressLint("WakelockTimeout")
  @Synchronized
  fun setPlaybackAwake(context: Context, awake: Boolean) {
    val lock = playbackLock ?: newLock(context).also { playbackLock = it }
    if (awake && !lock.isHeld) {
      lock.acquire()
    } else if (!awake && lock.isHeld) {
      lock.release()
    }
  }

  private fun newLock(context: Context): PowerManager.WakeLock {
    val power = context.applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
    return power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG).apply {
      setReferenceCounted(false)
    }
  }
}

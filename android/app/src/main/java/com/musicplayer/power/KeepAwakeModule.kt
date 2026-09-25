package com.musicplayer.power

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Módulo "KeepAwake" para JS: mantener despierto el equipo mientras suena. */
class KeepAwakeModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

  override fun getName(): String = NAME

  @ReactMethod
  fun setPlaybackAwake(awake: Boolean) {
    KeepAwake.setPlaybackAwake(ctx, awake)
  }

  // Si React se reinicia, JS ya no podría soltarlo: se suelta acá.
  override fun invalidate() {
    KeepAwake.setPlaybackAwake(ctx, false)
    super.invalidate()
  }

  companion object {
    const val NAME = "KeepAwake"
  }
}

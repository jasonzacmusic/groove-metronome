cmake_minimum_required(VERSION 3.22)

project(GrooveMetronomePlugin VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

FetchContent_Declare(
  JUCE
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG 8.0.12
  GIT_SHALLOW TRUE
)

FetchContent_MakeAvailable(JUCE)

juce_add_plugin(GrooveMetronomePlugin
  COMPANY_NAME "Nathaniel School of Music"
  BUNDLE_ID "com.nathanielschool.groovemetronome.plugin"
  IS_SYNTH FALSE
  NEEDS_MIDI_INPUT FALSE
  NEEDS_MIDI_OUTPUT FALSE
  IS_MIDI_EFFECT FALSE
  EDITOR_WANTS_KEYBOARD_FOCUS FALSE
  COPY_PLUGIN_AFTER_BUILD TRUE
  PLUGIN_MANUFACTURER_CODE Nsmg
  PLUGIN_CODE Gmtr
  FORMATS AU VST3 Standalone
  PRODUCT_NAME "Groove Metronome"
)

target_sources(GrooveMetronomePlugin
  PRIVATE
    Source/PluginProcessor.cpp
)

target_include_directories(GrooveMetronomePlugin
  PRIVATE
    Source
)

target_compile_definitions(GrooveMetronomePlugin
  PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
    JUCE_REPORT_APP_USAGE=0
    JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(GrooveMetronomePlugin
  PRIVATE
    juce::juce_audio_utils
  PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags
)

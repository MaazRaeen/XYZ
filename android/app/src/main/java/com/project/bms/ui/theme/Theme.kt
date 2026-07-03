package com.project.bms.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = ElectricCyan,
    secondary = ActiveBlue,
    tertiary = AlertGold,
    background = DarkBackground,
    surface = DarkSurface,
    error = CriticalRed,
    onPrimary = DarkBackground,
    onSecondary = TextLight,
    onBackground = TextLight,
    onSurface = TextLight
)

private val LightColorScheme = lightColorScheme(
    primary = ForestTeal,
    secondary = RoyalBlue,
    tertiary = WarningOrange,
    background = LightBackground,
    surface = LightSurface,
    error = ErrorRed,
    onPrimary = LightSurface,
    onSecondary = LightSurface,
    onBackground = TextDark,
    onSurface = TextDark
)

@Composable
fun BmsTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Disabled by default to retain custom premium HSL palettes
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}

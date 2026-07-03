package com.project.bms.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.project.bms.data.model.LoginRequest
import com.project.bms.data.model.RegisterRequest
import com.project.bms.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface AuthUiState {
    object Idle : AuthUiState
    object Loading : AuthUiState
    data class Success(val message: String) : AuthUiState
    data class Error(val error: String) : AuthUiState
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    // Flow reflecting active token presence
    val isUserLoggedIn = authRepository.isUserLoggedIn

    fun resetState() {
        _uiState.value = AuthUiState.Idle
    }

    fun login(email: String, password: String) {
        if (!validateEmail(email)) {
            _uiState.value = AuthUiState.Error("Invalid email address format.")
            return
        }
        if (!validatePassword(password)) {
            _uiState.value = AuthUiState.Error("Password must be at least 8 characters long.")
            return
        }

        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val result = authRepository.login(LoginRequest(email, password))
            result.fold(
                onSuccess = {
                    _uiState.value = AuthUiState.Success("Login successful.")
                },
                onFailure = {
                    _uiState.value = AuthUiState.Error(it.message ?: "Authentication failed")
                }
            )
        }
    }

    fun register(name: String, email: String, password: String) {
        if (name.isBlank()) {
            _uiState.value = AuthUiState.Error("Name cannot be blank.")
            return
        }
        if (!validateEmail(email)) {
            _uiState.value = AuthUiState.Error("Invalid email address format.")
            return
        }
        if (!validatePassword(password)) {
            _uiState.value = AuthUiState.Error("Password must be at least 8 characters long.")
            return
        }

        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val result = authRepository.register(RegisterRequest(name, email, password))
            result.fold(
                onSuccess = {
                    _uiState.value = AuthUiState.Success("Registration successful.")
                },
                onFailure = {
                    _uiState.value = AuthUiState.Error(it.message ?: "Registration failed")
                }
            )
        }
    }

    fun forgotPassword(email: String) {
        if (!validateEmail(email)) {
            _uiState.value = AuthUiState.Error("Invalid email address format.")
            return
        }

        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val result = authRepository.forgotPassword(email)
            result.fold(
                onSuccess = {
                    _uiState.value = AuthUiState.Success(it)
                },
                onFailure = {
                    _uiState.value = AuthUiState.Error(it.message ?: "Password reset failed")
                }
            )
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            resetState()
        }
    }

    // Input Validation logic
    private fun validateEmail(email: String): Boolean {
        val emailRegex = "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\$".toRegex()
        return email.isNotBlank() && emailRegex.matches(email)
    }

    private fun validatePassword(password: String): Boolean {
        return password.isNotBlank() && password.length >= 8
    }
}

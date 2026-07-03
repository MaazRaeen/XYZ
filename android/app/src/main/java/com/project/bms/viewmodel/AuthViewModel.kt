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

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _authState = MutableStateFlow<Result<Any>?>(null)
    val authState: StateFlow<Result<Any>?> = _authState.asStateFlow()

    // Flow reflecting active token presence
    val isUserLoggedIn = authRepository.isUserLoggedIn

    fun login(email: String, password: String) {
        viewModelScope.launch {
            val result = authRepository.login(LoginRequest(email, password))
            _authState.value = result.map { it }
        }
    }

    fun register(name: String, email: String, password: String) {
        viewModelScope.launch {
            val result = authRepository.register(RegisterRequest(name, email, password))
            _authState.value = result.map { it }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
        }
    }
}

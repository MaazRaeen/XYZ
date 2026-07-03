package com.project.bms.di

import android.content.Context
import com.project.bms.data.local.TokenManager
import com.project.bms.data.remote.AuthInterceptor
import com.project.bms.data.remote.BmsApiService
import com.project.bms.data.repository.AuthRepository
import com.project.bms.data.repository.AuthRepositoryImpl
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideTokenManager(@ApplicationContext context: Context): TokenManager {
        return TokenManager(context)
    }

    @Provides
    @Singleton
    fun provideAuthInterceptor(tokenManager: TokenManager): AuthInterceptor {
        return AuthInterceptor(tokenManager)
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideBmsApiService(okHttpClient: OkHttpClient): BmsApiService {
        return Retrofit.Builder()
            .baseUrl("http://10.0.2.2:3000/api/v1/") // standard android loopback port mapping to host localhost
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(BmsApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideAuthRepository(apiService: BmsApiService, tokenManager: TokenManager): AuthRepository {
        return AuthRepositoryImpl(apiService, tokenManager)
    }

    @Provides
    @Singleton
    fun provideBleRepository(@ApplicationContext context: Context): BleRepository {
        return BleRepositoryImpl(context)
    }

    @Provides
    @Singleton
    fun provideBatteryRepository(apiService: BmsApiService): BatteryRepository {
        return BatteryRepositoryImpl(apiService)
    }
}

package xyz.askbox.app.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import xyz.askbox.app.data.repository.AskBoxRepository
import xyz.askbox.app.data.repository.AuthRepository
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    
    @Binds
    @Singleton
    abstract fun bindAuthRepository(
        askBoxRepository: AskBoxRepository
    ): AuthRepository
}

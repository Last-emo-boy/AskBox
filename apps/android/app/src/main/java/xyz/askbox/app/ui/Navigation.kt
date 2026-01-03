package xyz.askbox.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import xyz.askbox.app.ui.debug.DebugLogScreen
import xyz.askbox.app.ui.screens.*

sealed class Screen(val route: String) {
    data object Home : Screen("home")
    data object CreateAccount : Screen("create_account")
    data object ImportAccount : Screen("import_account")
    data object Login : Screen("login")
    data object Dashboard : Screen("dashboard")
    data object Boxes : Screen("boxes")
    data object Questions : Screen("questions/{slug}") {
        fun createRoute(slug: String) = "questions/$slug"
    }
    data object AskQuestion : Screen("ask/{slug}") {
        fun createRoute(slug: String) = "ask/$slug"
    }
    data object Receipts : Screen("receipts")
    data object Account : Screen("account")
    data object DebugLog : Screen("debug_log")
}

@Composable
fun AskBoxApp() {
    val navController = rememberNavController()
    val viewModel: MainViewModel = hiltViewModel()
    val hasAccount by viewModel.hasAccount.collectAsState()
    val isUnlocked by viewModel.isUnlocked.collectAsState()

    val startDestination = when {
        hasAccount == null -> Screen.Home.route // Loading
        hasAccount == true && !isUnlocked -> Screen.Login.route
        hasAccount == true && isUnlocked -> Screen.Dashboard.route
        else -> Screen.Home.route
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                onCreateAccount = { navController.navigate(Screen.CreateAccount.route) },
                onImportAccount = { navController.navigate(Screen.ImportAccount.route) },
                onEnterDashboard = { 
                    if (isUnlocked) {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Home.route) { inclusive = true }
                        }
                    } else {
                        navController.navigate(Screen.Login.route)
                    }
                }
            )
        }

        composable(Screen.CreateAccount.route) {
            CreateAccountScreen(
                onBack = { navController.popBackStack() },
                onAccountCreated = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.ImportAccount.route) {
            ImportAccountScreen(
                onBack = { navController.popBackStack() },
                onAccountImported = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Login.route) {
            LoginScreen(
                onBack = { navController.popBackStack() },
                onLoginSuccess = {
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToBoxes = { navController.navigate(Screen.Boxes.route) },
                onNavigateToReceipts = { navController.navigate(Screen.Receipts.route) },
                onNavigateToAccount = { navController.navigate(Screen.Account.route) },
                onNavigateToQuestions = { slug -> 
                    navController.navigate(Screen.Questions.createRoute(slug))
                }
            )
        }

        composable(Screen.Boxes.route) {
            BoxesScreen(
                onBack = { navController.popBackStack() },
                onNavigateToQuestions = { slug ->
                    navController.navigate(Screen.Questions.createRoute(slug))
                }
            )
        }

        composable(
            route = Screen.Questions.route,
            arguments = listOf(navArgument("slug") { type = NavType.StringType })
        ) { backStackEntry ->
            val slug = backStackEntry.arguments?.getString("slug") ?: return@composable
            QuestionsScreen(
                slug = slug,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.AskQuestion.route,
            arguments = listOf(navArgument("slug") { type = NavType.StringType })
        ) { backStackEntry ->
            val slug = backStackEntry.arguments?.getString("slug") ?: return@composable
            AskQuestionScreen(
                slug = slug,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Receipts.route) {
            ReceiptsScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Account.route) {
            AccountScreen(
                onBack = { navController.popBackStack() },
                onAccountDeleted = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateToDebug = { navController.navigate(Screen.DebugLog.route) }
            )
        }
        
        composable(Screen.DebugLog.route) {
            DebugLogScreen(
                onBack = { navController.popBackStack() }
            )
        }
    }
}

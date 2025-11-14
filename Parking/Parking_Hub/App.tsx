import 'react-native-url-polyfill/auto';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { useCallback, useEffect, useState } from 'react';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SplashScreen from './src/screens/splash/SplashScreen';
import OnboardingScreen from './src/screens/onboarding/OnboardingScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import HomeScreen from './src/screens/home/HomeScreen';
import HistoryScreen from './src/screens/history/HistoryScreen';
import { AuthProvider } from './src/contexts/auth/AuthContext';
import { VehicleProvider } from './src/contexts/vehicles/VehicleContext';

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  const loadFonts = useCallback(async () => {
    try {
      await ExpoSplashScreen.preventAutoHideAsync();
      await Font.loadAsync({
        'Raleway-Light': require('./assets/fonts/Raleway-Light.ttf'),
        'Raleway-Regular': require('./assets/fonts/Raleway-Regular.ttf'),
        'Raleway-Medium': require('./assets/fonts/Raleway-Medium.ttf'),
        'Raleway-SemiBold': require('./assets/fonts/Raleway-SemiBold.ttf'),
        'Raleway-Bold': require('./assets/fonts/Raleway-Bold.ttf'),
        'Raleway-ExtraBold': require('./assets/fonts/Raleway-ExtraBold.ttf'),
      });
      setFontsLoaded(true);
    } catch (error) {
      console.error('Error loading fonts:', error);
    } finally {
      await ExpoSplashScreen.hideAsync();
    }
  }, []);

  useEffect(() => {
    loadFonts();
  }, [loadFonts]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <VehicleProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <Stack.Navigator
              initialRouteName="Splash"
              screenOptions={{
                headerShown: false
              }}
            >
              <Stack.Screen name="Splash" component={SplashScreen} />
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="History" component={HistoryScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </VehicleProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

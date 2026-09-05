import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SdkProvider } from './SdkContext';
import type { RootStackParamList } from './navigation';
import { colors } from './theme';
import HomeScreen from './screens/HomeScreen';
import GalleryScreen from './screens/GalleryScreen';
import CameraScreen from './screens/CameraScreen';
import ResultScreen from './screens/ResultScreen';
import AboutScreen from './screens/AboutScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    primary: colors.accent,
    border: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <SdkProvider>
        <StatusBar barStyle="light-content" />
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.accent,
              headerTitleStyle: { color: colors.text, fontWeight: '600' },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Gallery"
              component={GalleryScreen}
              options={{ title: 'From Gallery' }}
            />
            <Stack.Screen
              name="Camera"
              component={CameraScreen}
              options={{ headerShown: false, animation: 'fade' }}
            />
            <Stack.Screen
              name="Result"
              component={ResultScreen}
              options={{ title: 'Result' }}
            />
            <Stack.Screen
              name="About"
              component={AboutScreen}
              options={{ title: 'About' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SdkProvider>
    </SafeAreaProvider>
  );
}

import React from 'react';
import { useFonts } from 'expo-font';
import Screen1 from './screens/Screen1';
import Screen2 from './screens/Screen2';
import Screen3 from './screens/Screen3';

const OnboardingScreen = () => {
  const [currentScreen, setCurrentScreen] = React.useState(0);

  const [fontsLoaded] = useFonts({
    'Raleway-Regular': require('../../../assets/fonts/Raleway-Regular.ttf'),
    'Raleway-Bold': require('../../../assets/fonts/Raleway-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleNext = () => {
    if (currentScreen < 2) {
      setCurrentScreen(currentScreen + 1);
    }
  };

  const handleSkip = () => {
    setCurrentScreen(2);
  };

  switch (currentScreen) {
    case 0:
      return <Screen1 onNext={handleNext} onSkip={handleSkip} />;
    case 1:
      return <Screen2 onNext={handleNext} onSkip={handleSkip} />;
    case 2:
      return <Screen3 onNext={handleNext} onSkip={handleSkip} />;
    default:
      return <Screen1 onNext={handleNext} onSkip={handleSkip} />;
  }
};

export default OnboardingScreen;
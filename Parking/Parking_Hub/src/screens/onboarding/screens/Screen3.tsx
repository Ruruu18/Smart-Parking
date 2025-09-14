import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

interface Screen3Props {
  onNext: () => void;
  onSkip: () => void;
}

type NavigationProps = {
  navigate: (screen: string) => void;
};

const Screen3: React.FC<Screen3Props> = ({ onSkip }) => {
  const navigation = useNavigation<NavigationProps>();
  return (
    <View style={styles.container}>
      <View style={styles.backgroundImage}>
        <Image 
          source={require('../../../../assets/images/backdrop/Onboarding 2-C.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <Image 
              source={require('../../../../assets/images/icons/member.png')}
              style={[styles.memberIcon, { tintColor: '#FF0000' }]}
            />
            <Text style={styles.title}>Become a Member</Text>
          </View>
          <Text style={styles.description}>Create Account to book and manages the parking facilities at <Text style={styles.highlightText}>Parking Hub</Text></Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.getButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.getText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  iconContainer: {
    marginBottom: 15,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  memberIcon: {
    width: 45,
    height: 45,
    resizeMode: 'contain',
    marginRight: 10,
  },
  title: {
    fontFamily: 'Raleway-Light',
    fontSize: 18,
    color: '#fff',
  },
  description: {
    fontFamily: 'Raleway-Regular',
    fontSize: 38,
    color: '#fff',
    lineHeight: 38,
  },
  highlightText: {
    fontFamily: 'Raleway-ExtraBold',
    color: '#FFD700',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 70,
    alignItems: 'center', 
  },
  getButton: {
    backgroundColor: '#FFD700',
    width: 201,
    height: 53,
    borderRadius: 15,
    justifyContent: 'center', 
    alignItems: 'center', 
  },
  getText: {
    color: '#000',
    fontSize: 20,
    fontFamily: 'Raleway-SemiBold',
    textAlign: 'center',
  },
});

export default Screen3;
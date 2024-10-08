import React, { useState, useEffect } from 'react';
import { Alert, Image, ImageBackground, View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { Checkbox, TextInput } from 'react-native-paper';
import { firebase } from './FirebaseConfig';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import loginbg from '../assets/loginbg.jpg'; 
import logo from '../assets/logo.png';
import viewIcon from '../assets/icons/view.png';
import viewOffIcon from '../assets/icons/hide.png';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    const checkLogin = async () => {
      const savedEmail = await AsyncStorage.getItem('email');
      const savedPassword = await AsyncStorage.getItem('password');
      if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
      }
    };
    checkLogin();

    const authListener = firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        navigation.navigate('Home');
      }
    });

    return () => authListener();
  }, []);

  const onLogin = async () => {
    try {
      console.log(`Attempting login with EmployeeId/UserId: ${email} and Password: ${password}`);
  
      const teacherQuerySnapshot = await firebase.firestore().collection('teachers')
        .where('employeeId', '==', email)
        .get();
  
      const userQuerySnapshot = await firebase.firestore().collection('users')
        .where('userId', '==', email)
        .get();
  
      let userDoc = null;
  
      if (!teacherQuerySnapshot.empty) {
        // Teacher document found
        const teacherDoc = teacherQuerySnapshot.docs[0];
        if (teacherDoc.data().password === password) {
          userDoc = teacherDoc;
          console.log(`Found teacher with EmployeeId: ${userDoc.data().employeeId} and Password: ${userDoc.data().password}`);
        }
      } else if (!userQuerySnapshot.empty) {
        // User document found
        const userDocSnapshot = userQuerySnapshot.docs[0];
        if (userDocSnapshot.data().password === password) {
          userDoc = userDocSnapshot;
          console.log(`Found user with UserId: ${userDoc.data().userId} and Password: ${userDoc.data().password}`);
        }
      }
  
      console.log("User Document: ", userDoc);
  
      if (userDoc) {
        const positionTitle = userDoc.data().positionTitle || 'N/A';
        const imageUrl = userDoc.data().imageUrl || '';
        const fullName = userDoc.data().firstName + ' ' + (userDoc.data().middleName || '') + ' ' + userDoc.data().lastName;
  
        await AsyncStorage.clear();
  
        // Ensure email and password are not undefined or null before setting
        if (email) await AsyncStorage.setItem('email', email);
        if (password) await AsyncStorage.setItem('password', password);
        if (positionTitle) await AsyncStorage.setItem('positionTitle', positionTitle);
        if (imageUrl) await AsyncStorage.setItem('imageUrl', imageUrl);
        await AsyncStorage.setItem('fullName', fullName);
  
        navigation.navigate('Main');
  
      } else {
        Alert.alert("Login Failed", "Invalid username or password. Please try again.");
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Login Error", "An error occurred during login. Please try again later.");
    }
  };
  

  return (
    <ImageBackground source={loginbg} style={styles.container}>
      <Image source={logo} style={styles.logo} />
      <View style={{alignItems: 'center', marginBottom: 20 }}>
        <Text style={styles.welcomeTextPrimary}>WELCOME TO</Text>
        <Text style={styles.welcomeTextSecondary}>COLLEGE OF INFORMATION AND{'\n'}COMPUTING SCIENCES TEACHERS PORTAL</Text>
      </View>
      <View style={styles.bottomBox}>
        <TextInput
          label="Teacher/User ID"
          value={email}
          onChangeText={setEmail}
          style={[styles.input, { backgroundColor: 'transparent' }]}
          mode="flat"
          theme={{ colors: { underlineColor:'transparent', background :'transparent' }}}
        />
        <View style={styles.passwordContainer}>
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible} // Toggle based on the state
            style={[styles.input, { flex: 1, backgroundColor: 'transparent' }]}
            mode="flat"
            theme={{ colors: { underlineColor:'transparent', background :'transparent' }}}
          />
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)} style={styles.viewIcon}>
            <Image source={passwordVisible ? viewOffIcon : viewIcon} style={{ width: 24, height: 24 }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={onLogin}>
          <Text style={styles.buttonText}>LOGIN</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}
  
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10, 
  },
  viewIcon: {
    marginLeft: 10, 
  },
  logo: {
    alignSelf: 'center', 
    marginBottom: height * 0.01, 
    width: 200,
    height: 200,
  },
  bottomBox: {
    height: height * 0.45,
    elevation: 5,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    padding: 16,
    overflow: 'hidden',
    borderRadius: 10,
  },
  input: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: height * 0.05,
  },
  button: {
    height: height * 0.075,
    justifyContent: 'center',
    backgroundColor: 'orange',
    padding: 10,
    borderRadius: 10,
    marginTop: height * 0.065,
    elevation: 5,
  },
  buttonText: {
    fontSize: width * 0.05,
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  welcomeTextPrimary: {
    textAlign: 'center',
    color: '#950f0f',
    fontSize: width * 0.1, 
    fontWeight: 'bold',
    marginBottom: 5, 
  },
  welcomeTextSecondary: {
    textAlign: 'center',
    color: 'black', 
    fontSize: width * 0.055,
    fontWeight: 'bold',
  },
});
import React, { useState, useEffect } from 'react';
import { Alert, Modal, TextInput, View, StyleSheet, Text, FlatList, TouchableOpacity, BackHandler, Dimensions, Platform } from 'react-native';
import { firebase } from './FirebaseConfig';
import { Provider, Menu, Button } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

export default function AttendancePage({ navigation, route }) {
  const { subjects } = route.params;
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [schedule, setSchedule] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(''); 
  const [menuVisible, setMenuVisible] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [totalModalVisible, setTotalModalVisible] = useState(false);
  const [selectedTotalType, setSelectedTotalType] = useState(null); 
  const [totalInputValue, setTotalInputValue] = useState('');
  const [totalAbsences, setTotalAbsences] = useState(0);
  const [totalDaysPresent, setTotalDaysPresent] = useState(0);

  useEffect(() => {
    const fetchTotals = async () => {
      try {
        const querySnapshot = await firebase.firestore().collection('subjects')
          .where('classCode', '==', classCode).get();

        if (!querySnapshot.empty) {
          const subjectDoc = querySnapshot.docs[0].data(); 
          setTotalAbsences(subjectDoc.totalAbsences || 0);
          setTotalDaysPresent(subjectDoc.totalDaysPresent || 0);
        } else {
          console.log('No subject found with the classCode:', classCode);
        }
      } catch (error) {
        console.error("Error fetching subject totals:", error);
      }
    };

    fetchTotals();
  }, [classCode]); 

  useEffect(() => {
    const backAction = () => {
      navigation.goBack();
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    if (subjects.length > 0 && subjects[0].students) {
      setStudents(subjects[0].students);
      const initialRecords = {};
      subjects[0].students.forEach(student => {
        initialRecords[student.name] = 'absent'; 
      });
      setAttendanceRecords(initialRecords);
    }
  }, [subjects]);

  useEffect(() => {
    const classCode = subjects[0]?.classCode;
    if (classCode) {
      const scheduleQuery = firebase.firestore().collection('schedule').where('classCode', '==', classCode);
      scheduleQuery.get().then((querySnapshot) => {
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          const data = doc.data();
          const period = data.period;
          const { name, classCode } = subjects[0];
          setClassCode(classCode);
          setSchedule({
            ...data,
            period,
            name,
            classCode,
          });
        } else {
          const { name, classCode } = subjects[0];
          setSchedule({ name, classCode });
        }
      }).catch((error) => {
        console.error("Error getting documents:", error);
      });
    }
  }, [subjects]);

  const setStatus = (studentName, status) => {
    setSelectedStudent({ name: studentName, status });
    console.log("Setting status for", studentName, status);
    setModalVisible(true);
  };  

  const submitAttendance = async (newValue) => {
    if (!selectedStudent) return;
    const parsedNewValue = parseInt(newValue, 10);
    const querySnapshot = await firebase.firestore().collection('subjects')
      .where('classCode', '==', classCode).get();

    if (!querySnapshot.empty) {
      const subjectDoc = querySnapshot.docs[0];
      const studentsCollectionRef = subjectDoc.ref.collection(classCode);

      const studentQuerySnapshot = await studentsCollectionRef.where('name', '==', selectedStudent.name).get();

      if (!studentQuerySnapshot.empty) {
        const studentDoc = studentQuerySnapshot.docs[0];
        const studentDocRef = studentDoc.ref;
        let attendance = studentDoc.data().attendance || [0, 0, 0, 0];

        const statusIndexMap = { present: 0, absent: 1, excuse: 2, late: 3 };
        const index = statusIndexMap[selectedStudent.status];

        if (index !== undefined && !isNaN(parsedNewValue)) {
          // Update the specific index with parsedNewValue
          attendance[index] = parsedNewValue;
        }

        studentDocRef.update({
          attendance: attendance
        }).then(() => {
          console.log('Attendance updated for', selectedStudent.name);
          setSelectedWeek('');
          setModalVisible(false);
        }).catch((error) => {
          console.error("Error updating document:", error);
        });
      } else {
        console.log('No student found with the name:', selectedStudent.name);
      }
    } else {
      console.log('No subject found with the classCode:', classCode);
    }
  };

  const submitFinalAttendanceForAll = async () => {
    Alert.alert(
      "Confirm Submission",
      "Are you sure you want to submit the final attendance for all students?",
      [
        {
          text: "Cancel",
          onPress: () => console.log("Submission cancelled"),
          style: "cancel"
        },
        { text: "OK", onPress: () => submitFinalAttendance() }
      ]
    );
  };

  const submitFinalAttendance = async () => {
    const querySnapshot = await firebase.firestore().collection('subjects')
      .where('classCode', '==', classCode).get();

    if (!querySnapshot.empty) {
      const subjectDoc = querySnapshot.docs[0];
      const studentsCollectionRef = subjectDoc.ref.collection(classCode);

      const studentQuerySnapshot = await studentsCollectionRef.get();

      if (!studentQuerySnapshot.empty) {
        studentQuerySnapshot.docs.forEach(async (studentDoc) => {
          const studentDocRef = studentDoc.ref;
          let attendance = studentDoc.data().attendance || [0, 0, 0, 0];
          let finalAttendance = studentDoc.data().finalAttendance || [0, 0, 0, 0];

          finalAttendance = finalAttendance.map((val, index) => val + (attendance[index] || 0));

          await studentDocRef.update({
            finalAttendance: finalAttendance,
            attendance: [0, 0, 0, 0]
          }).then(() => {
            console.log('Final attendance updated for', studentDoc.data().name);
          }).catch((error) => {
            console.error("Error updating document for", studentDoc.data().name, ":", error);
          });
        });
        
        Alert.alert('Success', 'Final attendance submitted successfully.');

      } else {
        console.log('No students found in the class:', classCode);
      }
    } else {
      console.log('No subject found with the classCode:', classCode);
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'green';
      case 'absent': return 'red';
      case 'excuse': return 'blue';
      case 'late': return 'yellow';
      default: return 'grey';
    }
  };

const fetchDataAndGeneratePDF = async () => {
    let totalClassAbsences = 0;
    let totalClassPresence = 0;

    try {
      const querySnapshot = await firebase.firestore().collection('subjects')
        .where('classCode', '==', classCode).get();
      
      if (querySnapshot.empty) {
        console.log('No subject found with the classCode:', classCode);
        return;
      }

      const subjectDoc = querySnapshot.docs[0].data();
      const studentsCollectionRef = querySnapshot.docs[0].ref.collection(classCode);
      const studentDocsSnapshot = await studentsCollectionRef.get();
      const students = [];

      studentDocsSnapshot.forEach(doc => {
        let studentData = doc.data();
        // Ensure attendance is an array of numbers, defaulting to 0 if undefined
        studentData.finalAttendance = studentData.finalAttendance ? studentData.finalAttendance.map(Number) : [0, 0, 0, 0];
        students.push(studentData);
      });

      const totalAbsences = subjectDoc.totalAbsences || 0;
      const totalDaysPresent = subjectDoc.totalDaysPresent || 0;
      const fullName = await AsyncStorage.getItem('fullName');

      const header = `<h1 style="text-align:center;">Class Code: ${classCode}</h1><h2 style="text-align:center;">Period: ${schedule.period}</h2><h3 style="text-align:center;">Instructor: ${fullName}</h3><br>`;
      const style = `<style>
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 auto;
        }
        th, td {
          border: 1px solid black;
          text-align: center;
          padding: 8px;
        }
        tr:nth-child(even) {background-color: #f2f2f2;}
      </style>`;
      students.sort((a, b) => a.name.localeCompare(b.name));

      // Update the table header to include new columns for totals
      const attendanceTableHeader = `<table><tr><th>Student Name</th><th>Present</th><th>Absent</th><th>Excuse</th><th>Late</th><th>Total No. of Present</th><th>Total No. of Absence</th><th>Total No. of Excuse</th><th>Total No. of Late</th></tr>`;

      const attendanceTableRows = students.map(student => {
        let studentPresence = Number(student.finalAttendance[0]) || 0;
        let studentAbsence = Number(student.finalAttendance[1]) || 0;
        let studentExcuse = Number(student.finalAttendance[2]) || 0;
        let studentLate = Number(student.finalAttendance[3]) || 0;
      

        studentPresence = student.finalAttendance[0] || 0;
        studentAbsence = student.finalAttendance[1] || 0;
        studentExcuse = student.finalAttendance[2] || 0;
        studentLate = student.finalAttendance[3] || 0;

        // Update class totals
        totalClassAbsences += studentAbsence;
        totalClassPresence += studentPresence;

        // Generate table row for the student with totals
        const records = `<td>${studentPresence}</td><td>${studentAbsence}</td><td>${studentExcuse}</td><td>${studentLate}</td><td>${studentPresence}</td><td>${studentAbsence}</td><td>${studentExcuse}</td><td>${studentLate}</td>`;
        return `<tr><td>${student.name}</td>${records}</tr>`;
      }).join('');

      // Adjust the classTotalsRow to include totals for excuses and lates
      const classTotalsRow = `<tr style="font-weight:bold;"><td>Total</td><td>${totalClassPresence}</td><td>${totalClassAbsences}</td><td></td><td></td><td>${totalClassPresence}</td><td>${totalClassAbsences}</td><td></td><td></td></tr>`;

      const attendanceTableFooter = `</table>`;
      const attendanceTable = `${attendanceTableHeader}${attendanceTableRows}${attendanceTableFooter}`;
      

      const totals = `<br><p style="text-align:center;">Total No. of Absences: ${totalClassAbsences}</p><p style="text-align:center;">Total No. of Days Present: ${totalClassPresence}</p>`;

      const legend = `<br><p style="text-align:center;">Legend:</p><ul style="list-style-type:none; text-align:center;"><li>1 - present</li><li>0 - absent</li><li>Excuse and Late are marked accordingly</li></ul>`;
      const htmlContent = `${style}${header}${attendanceTable}`;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      console.log('PDF generated at:', uri);

      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = firebase.storage().ref();
      const fileRef = storageRef.child(`attendance_files/${classCode}_attendance_record.pdf`);
      await fileRef.put(blob);
      await Print.printAsync({ uri });

      Alert.alert('Success', 'Attendance PDF generated and uploaded to Firebase Storage successfully.');
    } catch (error) {
      console.error("Error fetching data or generating PDF:", error);
      Alert.alert('Error', 'There was an issue generating or uploading the attendance PDF.');
    }
  };

  const fetchCurrentData = async () => {
    let totalClassAbsences = 0;
    let totalClassPresence = 0;

    try {
      const querySnapshot = await firebase.firestore().collection('subjects')
        .where('classCode', '==', classCode).get();
      
      if (querySnapshot.empty) {
        console.log('No subject found with the classCode:', classCode);
        return;
      }

      const subjectDoc = querySnapshot.docs[0].data();
      const studentsCollectionRef = querySnapshot.docs[0].ref.collection(classCode);
      const studentDocsSnapshot = await studentsCollectionRef.get();
      const students = [];

      studentDocsSnapshot.forEach(doc => {
        let studentData = doc.data();
        // Ensure attendance is an array of numbers, defaulting to 0 if undefined
        studentData.attendance = studentData.attendance ? studentData.attendance.map(Number) : [0, 0, 0, 0];
        students.push(studentData);
      });

      const totalAbsences = subjectDoc.totalAbsences || 0;
      const totalDaysPresent = subjectDoc.totalDaysPresent || 0;
      const fullName = await AsyncStorage.getItem('fullName');

      const header = `<h1 style="text-align:center;">Class Code: ${classCode}</h1><h2 style="text-align:center;">Period: ${schedule.period}</h2><h3 style="text-align:center;">Instructor: ${fullName}</h3><br>`;
      const style = `<style>
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 0 auto;
        }
        th, td {
          border: 1px solid black;
          text-align: center;
          padding: 8px;
        }
        tr:nth-child(even) {background-color: #f2f2f2;}
      </style>`;
      students.sort((a, b) => a.name.localeCompare(b.name));

      // Update the table header to include new columns for totals
      const attendanceTableHeader = `<table><tr><th>Student Name</th><th>Present</th><th>Absent</th><th>Excuse</th><th>Late</th><th>Total No. of Present</th><th>Total No. of Absence</th><th>Total No. of Excuse</th><th>Total No. of Late</th></tr>`;

      const attendanceTableRows = students.map(student => {
        let studentPresence = Number(student.attendance[0]) || 0;
        let studentAbsence = Number(student.attendance[1]) || 0;
        let studentExcuse = Number(student.attendance[2]) || 0;
        let studentLate = Number(student.attendance[3]) || 0;
      

        studentPresence = student.attendance[0] || 0;
        studentAbsence = student.attendance[1] || 0;
        studentExcuse = student.attendance[2] || 0;
        studentLate = student.attendance[3] || 0;

        // Update class totals
        totalClassAbsences += studentAbsence;
        totalClassPresence += studentPresence;

        // Generate table row for the student with totals
        const records = `<td>${studentPresence}</td><td>${studentAbsence}</td><td>${studentExcuse}</td><td>${studentLate}</td><td>${studentPresence}</td><td>${studentAbsence}</td><td>${studentExcuse}</td><td>${studentLate}</td>`;
        return `<tr><td>${student.name}</td>${records}</tr>`;
      }).join('');

      // Adjust the classTotalsRow to include totals for excuses and lates
      const classTotalsRow = `<tr style="font-weight:bold;"><td>Total</td><td>${totalClassPresence}</td><td>${totalClassAbsences}</td><td></td><td></td><td>${totalClassPresence}</td><td>${totalClassAbsences}</td><td></td><td></td></tr>`;

      const attendanceTableFooter = `</table>`;
      const attendanceTable = `${attendanceTableHeader}${attendanceTableRows}${attendanceTableFooter}`;
      

      const totals = `<br><p style="text-align:center;">Total No. of Absences: ${totalClassAbsences}</p><p style="text-align:center;">Total No. of Days Present: ${totalClassPresence}</p>`;

      const legend = `<br><p style="text-align:center;">Legend:</p><ul style="list-style-type:none; text-align:center;"><li>1 - present</li><li>0 - absent</li><li>Excuse and Late are marked accordingly</li></ul>`;
      const htmlContent = `${style}${header}${attendanceTable}`;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      console.log('PDF generated at:', uri);

      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = firebase.storage().ref();
      const fileRef = storageRef.child(`attendance_files/${classCode}_attendance_record.pdf`);
      await fileRef.put(blob);
      await Print.printAsync({ uri });

      Alert.alert('Success', 'Attendance PDF generated and uploaded to Firebase Storage successfully.');
    } catch (error) {
      console.error("Error fetching data or generating PDF:", error);
      Alert.alert('Error', 'There was an issue generating or uploading the attendance PDF.');
    }
  };

  const updateSubjectTotals = async (newValue, type) => {
    try {
      // Fetch the subject document using the classCode
      const querySnapshot = await firebase.firestore().collection('subjects')
        .where('classCode', '==', classCode).get();

      if (!querySnapshot.empty) {
        const subjectDocRef = querySnapshot.docs[0].ref;

        // Prepare the update object based on the type parameter
        const updateObject = {};
        if (type === 'absences') {
          updateObject.totalAbsences = parseInt(newValue, 10);
        } else if (type === 'present') {
          updateObject.totalDaysPresent = parseInt(newValue, 10);
        }

        // Update the document
        await subjectDocRef.update(updateObject);
        type === 'absences' ? setTotalAbsences(newValue) : setTotalDaysPresent(newValue);
        console.log(`Successfully updated total number of ${type}.`);
      } else {
        console.log('No subject found with the classCode:', classCode);
      }
    } catch (error) {
      console.error("Error updating subject totals:", error);
    }
  };

  return (
    <Provider>
      <FlatList
        data={students}
        keyExtractor={(item, index) => index.toString()}
        ListHeaderComponent={
          <>
            <View style={{ backgroundColor: 'blue', borderRadius: 10, paddingTop: 10, margin: 15 }}>
              <Text style={[styles.headerText, { textAlign: 'center', fontSize: width * 0.05, color: 'white' }]}>
                Students Attendance Record
              </Text>
            </View>
            <Text style={styles.headerText}>Class Code: {schedule.classCode}</Text>
            <Text style={styles.headerText}>Period: {schedule.period}</Text>
            <Text style={styles.headerText}>Instructor: {schedule.name}</Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.studentRow}>
            <Text style={styles.studentName}>{item.name}</Text>
            <View style={styles.statusButtons}>
              {['present', 'absent', 'excuse', 'late'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.statusButton, { backgroundColor: getStatusColor(status) }]}
                  onPress={() => setStatus(item.name, status)}
                >
                  <Text style={styles.statusText}>{status.charAt(0).toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        ListFooterComponent={
          <>
            { /*
            <TouchableOpacity onPress={() => { setTotalModalVisible(true); setSelectedTotalType('absences'); }} style={styles.buttonStyle}>
              <Text style={[styles.headerText, { marginBottom: 0, color: 'white' }]}>Total No. of Absences: {totalAbsences}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setTotalModalVisible(true); setSelectedTotalType('present'); }} style={styles.buttonStyle}>
              <Text style={[styles.headerText, { marginBottom: 0, color: 'white' }]}>Total No. of Days Present: {totalDaysPresent}</Text>
            </TouchableOpacity>
            */ }
            <TouchableOpacity style={styles.button} onPress={fetchDataAndGeneratePDF}>
              <Text style={styles.buttonText}>Generate and Print PDF File</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={fetchCurrentData}>
              <Text style={styles.buttonText}>View Record</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={submitFinalAttendanceForAll}>
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </>
        }
        
        contentContainerStyle={styles.container}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Student's {selectedStudent?.status}:</Text>
            <TextInput
              style={styles.input}
              onChangeText={setSelectedWeek}
              value={selectedWeek}
              keyboardType="numeric"
              maxLength={1} 
              placeholder={
                selectedStudent?.status === 'absent' ? 'Enter Number of Absences' :
                selectedStudent?.status === 'excuse' ? 'Enter Number of Excused Absences' :
                selectedStudent?.status === 'late' ? 'Enter Number of Lates' :
                'Enter Number of Days Present'
              }
            />
          <TouchableOpacity style={styles.submitButton} onPress={() => submitAttendance(selectedWeek)}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={totalModalVisible}
        onRequestClose={() => {
          setTotalModalVisible(!totalModalVisible);
        }}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Enter Total Number of {selectedTotalType === 'absences' ? 'Absences' : 'Days Present'}:</Text>
            <TextInput
              style={styles.input}
              onChangeText={setTotalInputValue}
              value={totalInputValue}
              keyboardType="numeric"
              placeholder="Enter Number"
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => {
                updateSubjectTotals(totalInputValue, selectedTotalType === 'absences' ? 'absences' : 'present');
                setTotalModalVisible(false);
                setTotalInputValue('');
              }}
            >
              <Text style={styles.submitButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: 'white',
  },
  buttonStyle: {
    backgroundColor: '#007bff', // Bootstrap primary button color
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 15,
    alignItems: 'center', // Center the text inside the button
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  studentName: {
    fontSize: 16,
  },
  statusButtons: {
    flexDirection: 'row',
  },
  statusButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
    width: 150,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalView: {
    margin: 20,
    backgroundColor: "white", // Ensure modal background is white
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center", // Ensure modal is centered vertically
    alignItems: "center", // Ensure modal is centered horizontally
    marginTop: 22
  },
  submitButton: {
    backgroundColor: "#2196F3", // Example button color
    borderRadius: 20,
    padding: 10,
    elevation: 2
  },
  submitButtonText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  }
});

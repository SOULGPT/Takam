import { StyleSheet, View, Text, TouchableOpacity, TextInput, ScrollView, Platform } from 'react-native';
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

interface EventDrawerProps {
  event: any;
  onClose: () => void;
}

export default function EventDrawer({ event, onClose }: EventDrawerProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    fetchTasks();
    const sub = supabase.channel(`tasks:${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_tasks', filter: `event_id=eq.${event.id}` }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [event.id]);

  const fetchTasks = async () => {
    const { data } = await supabase.from('event_tasks').select('*').eq('event_id', event.id).order('created_at', { ascending: true });
    if (data) setTasks(data);
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    await supabase.from('event_tasks').insert({
      event_id: event.id,
      bond_id: event.bond_id,
      title: newTaskTitle.trim()
    });
    setNewTaskTitle('');
  };

  const toggleTask = async (task: any) => {
    const newVal = !task.is_completed;
    if (newVal) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    await supabase.from('event_tasks').update({ is_completed: newVal }).eq('id', task.id);
  };

  return (
    <View style={styles.drawer}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <Text style={styles.title}>{event.title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close-circle" size={24} color="#B5947A" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.taskList} showsVerticalScrollIndicator={false}>
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onToggle={() => toggleTask(task)} />
        ))}

        <View style={styles.addBox}>
          <TextInput
            style={styles.input}
            placeholder="Add a task..."
            placeholderTextColor="#B5947A"
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            onSubmitEditing={addTask}
          />
          <TouchableOpacity onPress={addTask}>
            <Ionicons name="add-circle" size={28} color="#C9705A" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function TaskItem({ task, onToggle }: { task: any; onToggle: () => void }) {
  const [isDone, setIsDone] = useState(task.is_completed);
  const progress = useSharedValue(task.is_completed ? 1 : 0);

  useEffect(() => {
    setIsDone(task.is_completed);
    progress.value = withTiming(task.is_completed ? 1 : 0, { duration: 400 });
  }, [task.is_completed]);

  // Skia Path for "Pencil Strike"
  // Slightly wobbly line
  const path = useMemo(() => {
    if (Platform.OS === 'web') return null;
    const p = Skia.Path.Make();
    p.moveTo(0, 10);
    p.lineTo(150, 8); 
    return p;
  }, []);

  return (
    <TouchableOpacity style={styles.taskItem} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, isDone && styles.checkboxChecked]}>
        {isDone && <Ionicons name="checkmark" size={14} color="#FFF" />}
      </View>
      <View style={styles.taskTextContainer}>
        <Text style={[styles.taskText, isDone && styles.taskTextDone]}>
          {task.title}
        </Text>
        {/* Animated Skia Cross-out (Native) or CSS Fallback (Web) */}
        <View style={[styles.skiaOverlay, { pointerEvents: 'none' }]}>
           {Platform.OS !== 'web' ? (
              <Canvas style={{ flex: 1 }}>
                <Path
                  path={path!}
                  color="#4A4A4A"
                  style="stroke"
                  strokeWidth={2}
                  start={0}
                  end={isDone ? 1 : 0} 
                />
              </Canvas>
           ) : (
              isDone && (
                <View style={{
                  position: 'absolute',
                  top: '50%',
                  left: 0,
                  right: 0,
                  height: 2,
                  backgroundColor: '#4A4A4A',
                  opacity: 0.6,
                }} />
              )
           )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: '#FDF5E6',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#EDD9B8',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3D2B1F',
    fontFamily: 'CormorantGaramond_700Bold',
  },
  taskList: {
    maxHeight: 300,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D9BC8A',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  checkboxChecked: {
    backgroundColor: '#C9705A',
    borderColor: '#C9705A',
  },
  taskTextContainer: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  taskText: {
    fontSize: 16,
    color: '#4A4A4A',
    fontFamily: 'Caveat_400Regular',
  },
  taskTextDone: {
    opacity: 0.6,
  },
  skiaOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  addBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDD9B8',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Caveat_400Regular',
    color: '#3D2B1F',
    paddingVertical: 8,
  }
});

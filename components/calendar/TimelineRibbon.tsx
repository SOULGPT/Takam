import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Dimensions, TouchableOpacity, Platform } from 'react-native';
import dayjs, { EXCLUDED_CATEGORIES, findGreenZones, formatToTimezone } from '../../lib/utils/timezone';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, interpolate } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const ROW_HEIGHT = 80;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface TimelineRibbonProps {
  events: any[];
  myTz: string;
  partnerTz: string;
  partnerName?: string;
  onEventPress?: (event: any) => void;
}

export default function TimelineRibbon({ events, myTz, partnerTz, partnerName = 'Partner', onEventPress }: TimelineRibbonProps) {
  const dayStart = dayjs().startOf('day');

  // Compute Green Zones
  const myEvents = events.filter(e => e.creator_id !== 'partner'); // Simplified for now
  const partnerEvents = events.filter(e => e.creator_id === 'partner');
  
  const greenZones = useMemo(() => findGreenZones(myEvents, partnerEvents, dayStart), [events]);

  return (
    <View style={styles.container}>
      {/* Time headers */}
      <View style={styles.header}>
        <Text style={styles.headerText}>YOU ({myTz.split('/').pop()})</Text>
        <Text style={styles.headerText}>{partnerName.toUpperCase()} ({partnerTz.split('/').pop()})</Text>
      </View>

      <View style={styles.timelineBody}>
        {/* Parchment Vertical Ribbon */}
        <View style={styles.ribbon}>
          {HOURS.map((hour) => {
            const timeUTC = dayStart.add(hour, 'hour');
            const isGreen = greenZones.some(gz => 
              dayjs(timeUTC).isBetween(dayjs(gz.start), dayjs(gz.end), null, '[)')
            );

            return (
              <View key={hour} style={[styles.hourRow, isGreen && styles.greenZoneRow]}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>{timeUTC.tz(myTz).format('HH:mm')}</Text>
                </View>

                <View style={styles.dividerCol}>
                  <View style={styles.verticalLine} />
                  <View style={styles.hourMarker} />
                </View>

                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>{timeUTC.tz(partnerTz).format('HH:mm')}</Text>
                </View>

                {isGreen && hour % 4 === 0 && (
                   <View style={styles.greenZoneLabel}>
                      <Text style={styles.greenZoneText}>Connection Window</Text>
                   </View>
                )}
              </View>
            );
          })}

          {/* Render Events */}
          {events.map((event) => {
            const start = dayjs(event.start_time);
            const end = dayjs(event.end_time);
            const durationHours = end.diff(start, 'hour', true);
            const top = (dayjs(start).hour() + dayjs(start).minute() / 60) * ROW_HEIGHT;
            const height = durationHours * ROW_HEIGHT;
            
            const isGreenZoneEvent = !EXCLUDED_CATEGORIES.includes(event.category);

            return (
              <TouchableOpacity 
                key={event.id} 
                activeOpacity={0.9}
                onPress={() => onEventPress?.(event)}
                style={[
                  styles.eventCard, 
                  { top, height },
                  isGreenZoneEvent && styles.goldenGlow
                ]}
              >
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventCategory}>{event.category}</Text>
                
                {event.category === 'Flight' && (
                  <FlightAnimation duration={durationHours * 10000} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function FlightAnimation({ duration = 5000 }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    left: interpolate(progress.value, [0, 1], [20, width - 100]),
    opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
  }));

  return (
    <Animated.View style={[styles.plane, animatedStyle]}>
      <Ionicons name="airplane" size={16} color="#C9705A" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(253, 245, 230, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#EDD9B8',
    zIndex: 10,
  },
  headerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8C6246',
    letterSpacing: 1.2,
  },
  timelineBody: { flex: 1 },
  ribbon: {
    width: '100%',
    backgroundColor: '#FDF5E6', // Old Lace
  },
  hourRow: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenZoneRow: {
    backgroundColor: 'rgba(217, 188, 138, 0.1)',
  },
  timeCol: {
    flex: 1,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    color: '#4A4A4A',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Cormorant Garamond' : 'serif',
  },
  dividerCol: {
    width: 40,
    alignItems: 'center',
    height: '100%',
  },
  verticalLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#EDD9B8',
  },
  hourMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EDD9B8',
    position: 'absolute',
    top: '50%',
    marginTop: -3,
  },
  greenZoneLabel: {
    position: 'absolute',
    right: 20,
    top: 10,
  },
  greenZoneText: {
    fontSize: 10,
    color: '#D4A022',
    fontWeight: '700',
    fontStyle: 'italic',
  },
  eventCard: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#B5947A',
    zIndex: 5,
  },
  goldenGlow: {
    borderWidth: 1.5,
    borderColor: '#D4A022',
    shadowColor: '#D4A022',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3D2B1F',
    marginBottom: 2,
  },
  eventCategory: {
    fontSize: 11,
    color: '#8C6246',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  plane: {
    position: 'absolute',
    bottom: 4,
  }
});

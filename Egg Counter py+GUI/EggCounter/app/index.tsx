import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    SafeAreaView, Platform, useWindowDimensions, Switch
} from 'react-native';

// Import our new components and theme
import { Colors } from '../constants/theme';
import { LiveClock } from '../components/LiveClock';
import { CameraCard } from '../components/CameraCard';
import { LogCard } from '../components/LogCard';
import { TrendGraph } from '../components/TrendGraph';

const getIP = () => Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : "192.168.100.3";
const SERVER_IP = getIP();
const HTTP_URL = `http://${SERVER_IP}:5000`;
const WS_URL = `ws://${SERVER_IP}:8765`;

// --- UPDATED LABELS HERE ---
const CAMERAS = [
    { id: 0, name: "CAM 1: CONVEYOR 1" },
    { id: 1, name: "CAM 2: CONVEYOR 2" },
    { id: 2, name: "CAM 3: CONVEYOR 3" }
];
// ---------------------------

export default function EggCounterApp() {
    // UI State
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;
    const [view, setView] = useState('live');
    const [isDarkMode, setIsDarkMode] = useState(true);
    const theme = isDarkMode ? Colors.dark : Colors.light;

    // Data State
    const [isConnected, setIsConnected] = useState(false);
    const [camTotals, setCamTotals] = useState<{ [key: string]: number }>({ cam_0: 0, cam_1: 0, cam_2: 0 });
    const [historicalData, setHistoricalData] = useState<any>({});

    // WebSocket Connection
    useEffect(() => {
        const connectWebSocket = () => {
            const ws = new WebSocket(WS_URL);
            ws.onopen = () => setIsConnected(true);
            ws.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.type === 'update') setCamTotals(data.totals);
            };
            ws.onclose = () => { setIsConnected(false); setTimeout(connectWebSocket, 3000); };
            return ws;
        };
        const socket = connectWebSocket();
        return () => socket.close();
    }, []);

    // Fetch Historical Logs IMMEDIATELY to populate the trend indicators on the Live view
    useEffect(() => {
        fetch(`${HTTP_URL}/history`)
            .then(res => res.json())
            .then(setHistoricalData)
            .catch(err => console.error("Failed to fetch logs", err));
    }, []);

    // Calculate exactly what yesterday's date was in YYYY-MM-DD format
    const getYesterdayKey = () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };
    const yesterdayKey = getYesterdayKey();

    const handleReset = async (camId: number) => {
        if (Platform.OS === 'web' && !window.confirm(`Are you sure you want to reset Camera ${camId + 1}?`)) return;
        try { await fetch(`${HTTP_URL}/reset/${camId}`, { method: 'POST' }); }
        catch (error) { console.error("Failed to reset", error); }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>

            {/* RESPONSIVE HEADER */}
            <View style={{
                padding: 20,
                flexDirection: isDesktop ? 'row' : 'column',
                justifyContent: 'space-between',
                alignItems: isDesktop ? 'center' : 'flex-start',
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
                gap: 15
            }}>
                <View>
                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Egg Monitor Multi-Cam v2.0</Text>
                    <LiveClock colors={theme} />
                </View>

                {/* Mobile-Friendly Control Row */}
                <View style={{ flexDirection: 'row', width: isDesktop ? 'auto' : '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', backgroundColor: isDarkMode ? '#1A1A1A' : '#E0E0E0', borderRadius: 8, padding: 4 }}>
                        <TouchableOpacity style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: view === 'live' ? theme.primary : 'transparent' }} onPress={() => setView('live')}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: view === 'live' ? (isDarkMode ? '#000' : '#FFF') : theme.subText }}>LIVE</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: view === 'logs' ? theme.primary : 'transparent' }} onPress={() => setView('logs')}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: view === 'logs' ? (isDarkMode ? '#000' : '#FFF') : theme.subText }}>LOGS</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>

                        {/* THEME TOGGLE */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: theme.card,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: theme.border
                        }}>
                            <Switch
                                trackColor={{ false: '#767577', true: theme.primary }}
                                thumbColor={isDarkMode ? '#000' : '#f4f3f4'}
                                activeThumbColor={theme.text}
                                onValueChange={() => setIsDarkMode(!isDarkMode)}
                                value={isDarkMode}
                                style={[Platform.OS === 'web' ? { marginHorizontal: 4 } : { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }]}
                            />
                            <Text style={{ color: theme.text, fontSize: 10, fontWeight: 'bold', marginLeft: 2, marginRight: 6 }}>
                                {isDarkMode ? 'DARK' : 'LIGHT'}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: theme.border }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, marginRight: 6, backgroundColor: isConnected ? theme.success : theme.danger }} />
                            <Text style={{ color: theme.subText, fontSize: 10, fontWeight: 'bold' }}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* BODY */}
            <ScrollView contentContainerStyle={{ padding: 15 }}>
                {view === 'live' ? (
                    <>
                        <View style={{ justifyContent: 'center', alignItems: 'stretch', width: '100%', flexDirection: isDesktop ? 'row' : 'column' }}>
                            {CAMERAS.map((cam) => (
                                <CameraCard
                                    key={cam.id}
                                    cam={cam}
                                    total={camTotals[`cam_${cam.id}`] || 0}
                                    yesterdayTotal={historicalData[yesterdayKey]?.[`cam_${cam.id}`] || 0}
                                    isConnected={isConnected}
                                    httpUrl={HTTP_URL}
                                    isDesktop={isDesktop}
                                    colors={theme}
                                />
                            ))}
                        </View>

                        <TrendGraph
                            historicalData={historicalData}
                            colors={theme}
                            isDesktop={isDesktop}
                        />
                    </>
                ) : (
                    <View style={{ padding: 10 }}>
                        <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold', marginBottom: 15 }}>Current Shift</Text>
                        <View style={{ flexDirection: isDesktop ? 'row' : 'column', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                            {CAMERAS.map((cam) => (
                                <LogCard
                                    key={cam.id}
                                    cam={cam}
                                    total={camTotals[`cam_${cam.id}`] || 0}
                                    yesterdayTotal={historicalData[yesterdayKey]?.[`cam_${cam.id}`] || 0}
                                    onReset={handleReset}
                                    isDesktop={isDesktop}
                                    colors={theme}
                                />
                            ))}
                        </View>

                        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 20 }} />

                        <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold', marginBottom: 15 }}>Historical Database</Text>
                        <View style={{ backgroundColor: theme.card, borderRadius: 10, padding: 15, borderWidth: 1, borderColor: theme.border }}>
                            {Object.keys(historicalData).length === 0 ? (
                                <Text style={{ color: theme.subText }}>No historical data found.</Text>
                            ) : (
                                Object.keys(historicalData).sort().reverse().map(date => (
                                    <View key={date} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                        <Text style={{ color: theme.primary, fontSize: 14, fontWeight: 'bold' }}>{date}</Text>
                                        <View style={{ flexDirection: 'row', gap: 15 }}>
                                            <Text style={{ color: theme.subText, fontSize: 13 }}>Conveyor 1: <Text style={{ color: theme.text }}>{historicalData[date]['cam_0'] || 0}</Text></Text>
                                            <Text style={{ color: theme.subText, fontSize: 13 }}>Conveyor 2: <Text style={{ color: theme.text }}>{historicalData[date]['cam_1'] || 0}</Text></Text>
                                            <Text style={{ color: theme.subText, fontSize: 13 }}>Conveyor 3: <Text style={{ color: theme.text }}>{historicalData[date]['cam_2'] || 0}</Text></Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform, Image } from 'react-native';
import { WebView } from 'react-native-webview';

export const CameraCard = ({ cam, total, yesterdayTotal, isConnected, httpUrl, isDesktop, colors }: any) => {

    // Trend Calculation
    const diff = total - yesterdayTotal;
    const isUp = diff >= 0;
    const trendColor = isUp ? colors.success : colors.danger;
    const trendIcon = isUp ? '▲' : '▼';

    const streamUrl = `${httpUrl}/video_feed/${cam.id}`;

    // Injecting a simple HTML wrapper ensures the video scales perfectly 
    // and hides the default white webpage background (Used for Native iOS/Android only)
    const htmlContent = `
        <html>
            <body style="margin:0;padding:0;background-color:#000;display:flex;justify-content:center;align-items:center;height:100vh;">
                <img src="${streamUrl}" style="width:100%;height:100%;object-fit:contain;" />
            </body>
        </html>
    `;

    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, isDesktop ? { flex: 1, marginHorizontal: 8 } : { width: '100%', marginBottom: 20 }]}>
            <View style={styles.cardHeader}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>{cam.name}</Text>

                <View style={{ alignItems: 'flex-end' }}>
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.badgeText, { color: colors.badgeText }]}>{total}</Text>
                    </View>
                    <Text style={{ color: trendColor, fontSize: 10, marginTop: 4, fontWeight: 'bold' }}>
                        {trendIcon} {Math.abs(diff)} vs Yday
                    </Text>
                </View>
            </View> 

            <View style={styles.videoBox}>
                {isConnected ? (
                    /* CONDITIONAL RENDERING MAGIC HERE */
                    Platform.OS === 'web' ? (
                        <Image
                            source={{ uri: streamUrl }}
                            style={styles.stream}
                            resizeMode="contain"
                        />
                    ) : (
                        <WebView
                            source={{ html: htmlContent }}
                            style={styles.stream}
                            scrollEnabled={false}
                            bounces={false}
                            showsHorizontalScrollIndicator={false}
                            showsVerticalScrollIndicator={false}
                        />
                    )
                ) : (
                    <ActivityIndicator color={colors.primary} size="large" />
                )}
            </View>
            <Text style={{ color: colors.subText, fontSize: 9, marginTop: 8, textAlign: 'center', letterSpacing: 1 }}>REAL-TIME FEED</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    card: { borderRadius: 15, padding: 12, borderWidth: 1, minWidth: 280 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
    badgeText: { fontWeight: 'bold', fontSize: 20 },
    videoBox: { width: '100%', height: 220, borderRadius: 10, overflow: 'hidden', justifyContent: 'center' },
    // Added width/height 100% so both WebView and Image stretch correctly
    stream: { flex: 1, width: '100%', height: '100%', backgroundColor: 'transparent' },
});
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export const LogCard = ({ cam, total, yesterdayTotal, onReset, isDesktop, colors }: any) => {

    // Trend Calculation
    const diff = total - yesterdayTotal;
    const isUp = diff >= 0;
    const trendColor = isUp ? colors.success : colors.danger;
    const trendIcon = isUp ? '▲' : '▼';

    return (
        <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border, width: isDesktop ? '32%' : '100%' }]}>
            <View>
                <Text style={{ color: colors.primary, fontSize: 11, fontWeight: 'bold' }}>{cam.name}</Text>
                <Text style={{ color: colors.text, fontSize: 32, fontWeight: 'bold', marginTop: 5 }}>
                    {total} <Text style={{ fontSize: 14, color: colors.subText }}>eggs</Text>
                </Text>
                {/* Trend Display */}
                <Text style={{ color: trendColor, fontSize: 12, marginTop: 2, fontWeight: 'bold' }}>
                    {trendIcon} {Math.abs(diff)} vs yesterday
                </Text>
            </View>
            <TouchableOpacity
                style={[styles.resetBtn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
                onPress={() => onReset(cam.id)}
            >
                <Text style={{ color: colors.danger, fontWeight: 'bold', fontSize: 12 }}>RESET</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    logCard: { padding: 20, borderRadius: 10, borderWidth: 1, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    resetBtn: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
});
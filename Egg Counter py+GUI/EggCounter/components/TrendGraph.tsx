import React from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

export const TrendGraph = ({ historicalData, colors, isDesktop }: any) => {
    // 1. Process the data
    const dates = Object.keys(historicalData).sort(); // Sort chronologically

    // If we don't have enough data yet, show a placeholder
    if (dates.length < 2) {
        return (
            <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ color: colors.subText, textAlign: 'center', padding: 20 }}>
                    Not enough historical data to generate a trend graph. Check back tomorrow!
                </Text>
            </View>
        );
    }

    // Grab the last 7 days of data for a clean graph
    const recentDates = dates.slice(-7);

    // Format dates for the X-axis (e.g., "05/04")
    const labels = recentDates.map(date => {
        const [, month, day] = date.split('-');
        return `${month}/${day}`;
    });

    // Extract data points for each camera
    const cam0Data = recentDates.map(date => historicalData[date]['cam_0'] || 0);
    const cam1Data = recentDates.map(date => historicalData[date]['cam_1'] || 0);
    const cam2Data = recentDates.map(date => historicalData[date]['cam_2'] || 0);

    const screenWidth = Dimensions.get('window').width;
    // Adjust chart width based on desktop vs mobile padding
    const chartWidth = isDesktop ? screenWidth - 70 : screenWidth - 50;

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>7-Day Production Trend</Text>

            {/* Legend */}
            <View style={styles.legendContainer}>
                <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#BB86FC' }]} /><Text style={{ color: colors.subText, fontSize: 12 }}>Entry</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#03DAC6' }]} /><Text style={{ color: colors.subText, fontSize: 12 }}>Sorter</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: '#CF6679' }]} /><Text style={{ color: colors.subText, fontSize: 12 }}>Exit</Text></View>
            </View>

            <LineChart
                data={{
                    labels: labels,
                    datasets: [
                        { data: cam0Data, color: (opacity = 1) => `rgba(187, 134, 252, ${opacity})` }, // Purple
                        { data: cam1Data, color: (opacity = 1) => `rgba(3, 218, 198, ${opacity})` },   // Teal
                        { data: cam2Data, color: (opacity = 1) => `rgba(207, 102, 121, ${opacity})` }  // Red
                    ],
                }}
                width={chartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                    backgroundColor: colors.card,
                    backgroundGradientFrom: colors.card,
                    backgroundGradientTo: colors.card,
                    decimalPlaces: 0,
                    color: (opacity = 1) => colors.subText,
                    labelColor: (opacity = 1) => colors.subText,
                    style: { borderRadius: 16 },
                    propsForDots: { r: "4", strokeWidth: "2", stroke: colors.card }
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        width: '100%',
        alignItems: 'center'
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        alignSelf: 'flex-start',
        marginBottom: 10
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 10
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    legendColor: {
        width: 10,
        height: 10,
        borderRadius: 5
    }
});
import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';

export const LiveClock = ({ colors }: { colors: any }) => {
    const [time, setTime] = useState(new Date().toLocaleString());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date().toLocaleString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return <Text style={ { color: colors.subText, fontSize: 12, marginTop: 4, fontVariant: ['tabular-nums'] } }> { time } < /Text>;
};
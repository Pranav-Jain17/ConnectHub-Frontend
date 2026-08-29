import React, { useMemo, useEffect } from "react";
import { io } from "socket.io-client";

const SocketContext = React.createContext(null);

export const useSocket = () => {
    return React.useContext(SocketContext);
};

export const SocketProvider = (props) => {
    console.log('🔧 SocketProvider: Component rendering');

    // Create socket with authentication token
    const socket = useMemo(() => {
        console.log('🔧 useMemo: Creating socket instance');
        const token = localStorage.getItem('loginToken');

        console.log('🔐 Token status:', token ? 'EXISTS ✓' : 'MISSING ✗');
        if (token) {
            console.log('🔐 Token (first 20 chars):', token.substring(0, 20) + '...');
        }

        const socketInstance = io('http://3.110.101.93:3000', {
            auth: {
                token: token
            },
            autoConnect: false,
        });

        console.log('✅ Socket instance created');
        console.log('🌐 Server URL: http://3.110.101.93:3000'); // ✅ corrected log
        console.log('🔌 Auto-connect: false');

        return socketInstance;
    }, []); // Create once

    // Handle connection lifecycle and errors
    useEffect(() => {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔧 useEffect: Socket connection effect running');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const token = localStorage.getItem('loginToken');
        console.log('🔐 Checking token in useEffect...');
        console.log('   Token exists:', !!token);

        if (token) {
            console.log('✅ Token found - attempting connection...');
            console.log('   Connecting to: http://3.110.101.93:3000');

            socket.connect();
            console.log('📡 socket.connect() called');

            socket.on('connect', () => {
                console.log('\n🟢 ━━━ SOCKET CONNECTED ━━━');
                console.log('   Socket ID:', socket.id);
                console.log('   Connected:', socket.connected);
                console.log('   Time:', new Date().toISOString());
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            });

            socket.on('connect_error', (error) => {
                console.log('\n🔴 ━━━ CONNECTION ERROR ━━━');
                console.error('   Error:', error.message);
                console.error('   Error type:', error.type);
                console.error('   Time:', new Date().toISOString());
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                if (error.message === 'Authentication error: Invalid token' ||
                    error.message === 'Authentication error: No token provided') {
                    console.warn('⚠️ Invalid token detected - clearing from localStorage');
                    localStorage.removeItem('loginToken');
                }
            });

            socket.on('disconnect', (reason) => {
                console.log('\n🔴 ━━━ SOCKET DISCONNECTED ━━━');
                console.log('   Reason:', reason);
                console.log('   Time:', new Date().toISOString());
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            });

            socket.io.on('reconnect_attempt', (attempt) => {
                console.log(`🔄 Reconnection attempt ${attempt}...`);
            });

            socket.io.on('reconnect', (attempt) => {
                console.log(`✅ Reconnected after ${attempt} attempts`);
            });

            socket.io.on('reconnect_error', (error) => {
                console.error('❌ Reconnection error:', error.message);
            });

            socket.io.on('reconnect_failed', () => {
                console.error('❌ Reconnection failed - giving up');
            });
        } else {
            console.warn('\n⚠️ ━━━ NO TOKEN FOUND ━━━');
            console.warn('   Socket will NOT connect');
            console.warn('   User needs to login first');
            console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }

        // Cleanup on unmount
        return () => {
            console.log('\n🧹 ━━━ CLEANUP RUNNING ━━━');
            console.log('   Removing event listeners...');
            socket.off('connect');
            socket.off('connect_error');
            socket.off('disconnect');
            socket.io.off('reconnect_attempt');
            socket.io.off('reconnect');
            socket.io.off('reconnect_error');
            socket.io.off('reconnect_failed');

            console.log('   Disconnecting socket...');
            socket.disconnect();
            console.log('✅ Cleanup complete');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        };
    }, [socket]);

    console.log('🔧 SocketProvider: Rendering children');

    return (
        <SocketContext.Provider value={{ socket }}>
            {props.children}
        </SocketContext.Provider>
    );
};

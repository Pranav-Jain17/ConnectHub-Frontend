import React, { useMemo, useEffect } from "react";
import { io } from "socket.io-client";

const SocketContext = React.createContext(null);

export const useSocket = () => {
    return React.useContext(SocketContext);
};

export const SocketProvider = (props) => {
    const socket = useMemo(() => {
        const token = localStorage.getItem('loginToken');

        const socketInstance = io('https://connecthub.dikshant-ahalawat.live', {
            auth: {
                token: token
            },
            autoConnect: false,
        });

        return socketInstance;
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('loginToken');

        if (token) {
            socket.connect();

            socket.on('connect_error', (error) => {
                if (error.message === 'Authentication error: Invalid token' ||
                    error.message === 'Authentication error: No token provided') {
                    localStorage.removeItem('loginToken');
                }
            });
        }

        return () => {
            socket.off('connect');
            socket.off('connect_error');
            socket.off('disconnect');
            socket.io.off('reconnect_attempt');
            socket.io.off('reconnect');
            socket.io.off('reconnect_error');
            socket.io.off('reconnect_failed');

            socket.disconnect();
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={{ socket }}>
            {props.children}
        </SocketContext.Provider>
    );
};
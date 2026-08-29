import React from 'react';

export const SocketContext = React.createContext(null);

export const useSocket = () => {
    return React.useContext(SocketContext);
};

import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Components/Login';
import Signup from './Components/SignUp';
import Home from './Components/Home';
import Meeting from './Components/Meeting';
import ResetPassword from './Components/ResetPassword';
import { SocketProvider } from './Providers/Socket';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const PrivateRoute = ({ children }) => {
  const isAuth = !!localStorage.getItem("loginToken");
  return isAuth ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const isAuth = !!localStorage.getItem("loginToken");
  return isAuth ? <Navigate to="/home" replace /> : children;
};

function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/home" element={<PrivateRoute> <Home />  </PrivateRoute>} />
          <Route path="/meeting" element={<PrivateRoute> <Meeting /> </PrivateRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        </Routes>
      </SocketProvider>
      <ToastContainer position="top-right" autoClose={2000} />
    </BrowserRouter>
  );
}

export default App;
import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Components/Login';
import Signup from './Components/SignUp';
import Home from './Components/Home';
import Meeting from './Components/Meeting';
import { SocketProvider } from './Providers/Socket';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {

  return (
    <BrowserRouter>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/home" element={<Home />} />
          <Route path="/meeting" element={<Meeting />} />
        </Routes>
      </SocketProvider>
      <ToastContainer position="top-right" autoClose={2000} />
    </BrowserRouter>
  )
}

export default App

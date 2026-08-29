import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Components/Login';
import Signup from './Components/SignUp';
import Home from './Components/Home';
import Meeting from './Components/Meeting';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/meeting" element={<Meeting />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Components/login';
import Signup from './Components/SignUp';
import Home from './Components/Home';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

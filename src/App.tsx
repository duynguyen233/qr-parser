import { BrowserRouter, Route, Routes } from 'react-router-dom'
import JsonToolkit from './pages/json-toolkit'
import QRCodeParser from './pages/qr-parser'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="json-toolkit" element={<JsonToolkit />} />
        <Route path="*" element={<QRCodeParser />} />
      </Routes>
    </BrowserRouter>
  )
}

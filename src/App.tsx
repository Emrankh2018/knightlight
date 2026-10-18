import { Route, Routes } from 'react-router-dom';
import { m } from './i18n';
import Layout from './components/Layout';
import Home from './routes/Home';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="*" element={<p className="p-6">{m().common.notFound}</p>} />
      </Route>
    </Routes>
  );
}

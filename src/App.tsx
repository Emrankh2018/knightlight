import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { m } from './i18n';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Home from './routes/Home';

const Courses = lazy(() => import('./routes/Courses'));
const Course = lazy(() => import('./routes/Course'));
const Lesson = lazy(() => import('./routes/Lesson'));
const Puzzles = lazy(() => import('./routes/Puzzles'));
const Tactics = lazy(() => import('./routes/Tactics'));
const Teacher = lazy(() => import('./routes/Teacher'));
const Openings = lazy(() => import('./routes/Openings'));
const Play = lazy(() => import('./routes/Play'));
const Review = lazy(() => import('./routes/Review'));
const Students = lazy(() => import('./routes/Students'));
const Assign = lazy(() => import('./routes/Assign'));

export default function App() {
  return (
    <Suspense fallback={<p className="p-6 text-lg" role="status">{m().common.loading}</p>}>
      <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:slug" element={<Course />} />
          <Route path="learn/:slug/:lessonId" element={<Lesson />} />
          <Route path="puzzles" element={<Puzzles />} />
          <Route path="tactics" element={<Tactics />} />
          <Route path="teacher" element={<Teacher />} />
          <Route path="openings" element={<Openings />} />
          <Route path="play" element={<Play />} />
          <Route path="review" element={<Review />} />
          <Route path="students" element={<Students />} />
          <Route path="assign" element={<Assign />} />
          <Route path="*" element={<p className="p-6">{m().common.notFound}</p>} />
        </Route>
      </Routes>
      </ErrorBoundary>
    </Suspense>
  );
}

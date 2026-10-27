import { useState, useEffect } from 'react';
import api from '../lib/api';
import GhostChitView from '../components/GhostChitView';

export default function ChatPage() {
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    api.get('/subjects').then(res => setSubjects(res.data?.subjects || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
      <GhostChitView subjects={subjects} />
    </div>
  );
}

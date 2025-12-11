import StudentProfile from '../components/student/StudentProfile.jsx';
import MarksUpload from '../components/student/MarksUpload.jsx';
import CertificatesUpload from '../components/student/CertificatesUpload.jsx';
import ProjectsSection from '../components/student/ProjectsSection.jsx';
import InternshipSection from '../components/student/InternshipSection.jsx';
import LeaveRequest from '../components/student/LeaveRequest.jsx';
import FeedbackForm from '../components/student/FeedbackForm.jsx';
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const StudentDashboard = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/student/notifications');
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch (err) {
      console.error('Failed to load student notifications:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <StudentProfile />
        <MarksUpload />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CertificatesUpload />
        <ProjectsSection />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <InternshipSection />
        <LeaveRequest />
      </div>

      {/* Recent Notifications */}
      <section className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-lg font-semibold text-slate-800">Recent Notifications</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500 mt-3">No notifications yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {notifications.map((n) => (
              <li key={n.feature_id} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <p className="text-sm text-slate-800">{n.content}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FeedbackForm />
    </div>
  );
};

export default StudentDashboard;
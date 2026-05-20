import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardApi, projectApi, taskApi } from '../lib/api';
import { Alert, Badge, Button, Card, Input, Select, Spinner } from '../components/ui';

const STATUS_LABELS = { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' };
const PRIORITY_COLORS = { LOW: 'slate', MEDIUM: 'amber', HIGH: 'rose' };

export function ProjectDetail() {
  const { user } = useAuth();
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('tasks');
  const [memberEmail, setMemberEmail] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);

  const isAdmin = myRole === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [projRes, taskRes, dashRes] = await Promise.all([
        projectApi.get(projectId),
        taskApi.list(projectId),
        dashboardApi.get(projectId),
      ]);
      setProject(projRes.project);
      setTasks(taskRes.tasks);
      setMyRole(taskRes.myRole);
      setDashboard(dashRes.dashboard);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await projectApi.addMember(projectId, { email: memberEmail });
      setMemberEmail('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    try {
      await projectApi.removeMember(projectId, userId);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (task, status) => {
    try {
      await taskApi.update(task.id, { status });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await taskApi.delete(taskId);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <Spinner />;
  if (!project) return <Alert>Project not found</Alert>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-slate-400 hover:text-indigo-400">
          ← Back to projects
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <Badge color="indigo">{myRole}</Badge>
        </div>
        {project.description && <p className="mt-1 text-slate-400">{project.description}</p>}
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {['tasks', 'dashboard', 'members'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && dashboard && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total tasks" value={dashboard.totalTasks} />
          <StatCard label="Overdue" value={dashboard.overdueTasks} accent="rose" />
          <StatCard label="To Do" value={dashboard.byStatus.TODO} />
          <StatCard label="In Progress" value={dashboard.byStatus.IN_PROGRESS} />
          <StatCard label="Done" value={dashboard.byStatus.DONE} />
          <Card className="sm:col-span-2 lg:col-span-3">
            <h3 className="mb-3 font-medium text-slate-300">Tasks per user</h3>
            {dashboard.byUser.length === 0 ? (
              <p className="text-sm text-slate-500">No tasks yet</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.byUser.map((u) => (
                  <li key={u.userId || 'unassigned'} className="flex justify-between text-sm">
                    <span>{u.name}</span>
                    <span className="font-medium text-indigo-300">{u.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-4">
          {isAdmin && (
            <Card>
              <form onSubmit={handleAddMember} className="flex flex-wrap gap-3">
                <Input
                  label="Add member by email"
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="flex-1 min-w-[200px]"
                  required
                />
                <div className="flex items-end">
                  <Button type="submit">Add member</Button>
                </div>
              </form>
            </Card>
          )}
          <Card>
            <ul className="divide-y divide-slate-800">
              {project.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium">{m.user.name}</p>
                    <p className="text-sm text-slate-500">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={m.role === 'ADMIN' ? 'indigo' : 'slate'}>{m.role}</Badge>
                    {isAdmin && m.user.id !== project.creator.id && (
                      <Button variant="danger" className="!px-2 !py-1 text-xs" onClick={() => handleRemoveMember(m.user.id)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-4">
          {isAdmin && (
            <Button onClick={() => setShowTaskForm(!showTaskForm)}>
              {showTaskForm ? 'Cancel' : '+ New task'}
            </Button>
          )}
          {showTaskForm && isAdmin && (
            <TaskForm
              projectId={projectId}
              members={project.members}
              onSuccess={() => {
                setShowTaskForm(false);
                load();
              }}
              onError={setError}
            />
          )}
          {tasks.length === 0 ? (
            <Card className="py-12 text-center text-slate-400">No tasks yet</Card>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Card key={task.id} className={task.isOverdue ? 'border-rose-500/40' : ''}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{task.title}</h3>
                        <Badge color={PRIORITY_COLORS[task.priority]}>{task.priority}</Badge>
                        {task.isOverdue && <Badge color="rose">Overdue</Badge>}
                      </div>
                      {task.description && <p className="mt-1 text-sm text-slate-400">{task.description}</p>}
                      <p className="mt-2 text-xs text-slate-500">
                        {task.assignee ? `Assigned to ${task.assignee.name}` : 'Unassigned'}
                        {task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(isAdmin || task.assignee?.id === user?.id) && (
                        <Select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task, e.target.value)}
                          className="!w-auto"
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </Select>
                      )}
                      {isAdmin && (
                        <Button variant="danger" className="!px-2 !py-1 text-xs" onClick={() => handleDeleteTask(task.id)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const accentClass = accent === 'rose' ? 'text-rose-400' : 'text-indigo-400';
  return (
    <Card>
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accentClass}`}>{value}</p>
    </Card>
  );
}

function TaskForm({ projectId, members, onSuccess, onError }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await taskApi.create(projectId, {
        title,
        description,
        dueDate: dueDate || undefined,
        priority,
        assigneeId: assigneeId || undefined,
      });
      onSuccess();
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required className="sm:col-span-2" />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="sm:col-span-2"
        />
        <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </Select>
        <Select label="Assign to" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.name}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create task'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

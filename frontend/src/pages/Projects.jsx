import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectApi } from '../lib/api';
import { Alert, Badge, Button, Card, Input, Spinner } from '../components/ui';

export function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    projectApi
      .list()
      .then(({ projects }) => setProjects(projects))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await projectApi.create({ name, description });
      setName('');
      setDescription('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your projects</h1>
          <p className="text-slate-400">Create teams and manage tasks together</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New project'}
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {showForm && (
        <Card>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input label="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create project'}
            </Button>
          </form>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-slate-400">No projects yet. Create your first project to get started.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="transition hover:border-indigo-500/50 hover:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-lg">{p.name}</h2>
                  <Badge color={p.myRole === 'ADMIN' ? 'indigo' : 'slate'}>{p.myRole}</Badge>
                </div>
                {p.description && <p className="mt-2 text-sm text-slate-400 line-clamp-2">{p.description}</p>}
                <div className="mt-4 flex gap-4 text-xs text-slate-500">
                  <span>{p.members.length} members</span>
                  <span>{p.taskCount} tasks</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

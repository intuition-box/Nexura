import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Check, X } from "lucide-react";
import { TASKSS } from "../../../types/admin";
import QuestSubmissions from "../../../components/admin/QuestsSubmissions.tsx";
import { getStoredUserSession } from "../../../lib/userSession";
import { userApiRequest } from "../../../lib/userApi";
import { projectApiRequest } from "../../../lib/projectApi";
import { useToast } from "../../../hooks/use-toast";

export default function userDashboard() {
  const session = getStoredUserSession();
  const apiPrefix = session?.type === "user" ? "/user-hub" : "/hub";
  const apiRequest = session?.type === "user" ? userApiRequest : projectApiRequest;
  const { toast } = useToast();

  const [viewedSubmissions, setViewedSubmissions] = useState<Set<string>>(new Set());
  const [questTasks, setQuestTasks] = useState<TASKSS[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TASKSS | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const toggleUserSelection = (id: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const fetchQuests = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ pendingTasks?: TASKSS[] }>({
        endpoint: `${apiPrefix}/quest-submissions`,
        method: "GET",
      });
      const pendingTasks = res?.pendingTasks ?? [];
      setQuestTasks(pendingTasks.filter((task) => task.page === "user" || task.page === "quest"));
    } catch (err) {
      console.error("Failed to fetch quests:", err);
      setQuestTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch quests if user has a hub
    if (session?.hub) {
      fetchQuests();
    }
  }, [apiPrefix]);

  const handleView = (id: string) => {
    const task = questTasks.find((t) => t._id === id);
    if (!task) return;
    setSelectedTask(task);
    setViewModalOpen(true);
    setViewedSubmissions((prev) => new Set(prev).add(id));
  };

  const handleAction = async (id: string, action: "accept" | "reject") => {
    try {
      if (!session?.hub) {
        toast({ title: "Error", description: "Please create your hub first.", variant: "destructive" });
        return;
      }
      setLoading(true);
      await apiRequest({
        method: "POST",
        endpoint: `${apiPrefix}/validate-quest-submissions`,
        data: { submissionId: id, action },
      });
      await fetchQuests();
      setViewedSubmissions((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <QuestSubmissions
        tasks={questTasks}
        loading={loading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedUsers={selectedUsers}
        viewedSubmissions={viewedSubmissions}
        toggleUserSelection={toggleUserSelection}
        handleView={handleView}
        handleAction={handleAction}
        onRefresh={fetchQuests}
      />

      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submission</DialogTitle>
            <DialogDescription>{selectedTask?.taskType}</DialogDescription>
          </DialogHeader>

          <div className="text-white">{selectedTask?.submissionLink}</div>

          <div className="flex gap-2 mt-4">
            <Button
              disabled={!selectedTask}
              onClick={() => selectedTask && handleAction(selectedTask._id, "accept")}
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              disabled={!selectedTask}
              onClick={() => selectedTask && handleAction(selectedTask._id, "reject")}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

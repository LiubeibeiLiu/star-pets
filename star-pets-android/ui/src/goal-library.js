// The template is an invitation to start a plan; the habit is the child's editable plan.
// Older plans predate goalId, so a matching name is used only until the next edit/toggle.
export function findHabitForGoal(habits, goal) {
  return habits.find((habit) => habit.goalId === goal.id) ||
    habits.find((habit) => !habit.goalId && habit.name === goal.name);
}

export function goalDisplayName(habits, goal) {
  return findHabitForGoal(habits, goal)?.name || goal.name;
}

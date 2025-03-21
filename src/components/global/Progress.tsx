import { Progress } from "../../api/tasks";

export function SimpleProgressIndicator(props: { progress: Progress }) {
  // this complains about taking null but expecting undefined, but if we give it undefined it throws an error about the value being non-finite
  return (
    <progress
      value={props.progress.total === 0 ? null : props.progress.completed}
      max={props.progress.total}
    />
  );
}

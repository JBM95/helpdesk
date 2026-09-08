import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "core/schemas/users";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Role } from "core/constants/role.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ErrorAlert from "@/components/ErrorAlert";
import ErrorMessage from "@/components/ErrorMessage";

const roleLabel: Record<Role, string> = {
  [Role.agent]: "Agent",
  [Role.admin]: "Admin",
};

interface UserData {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface UserFormProps {
  user?: UserData;
  onSuccess: () => void;
}

export default function UserForm({ user, onSuccess }: UserFormProps) {
  const isEdit = !!user;
  const queryClient = useQueryClient();

  const form = useForm<CreateUserInput | UpdateUserInput>({
    resolver: zodResolver(isEdit ? updateUserSchema : createUserSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: "",
      role: user?.role ?? Role.agent,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: CreateUserInput | UpdateUserInput) => {
      if (isEdit) {
        const { data } = await axios.put(`/api/users/${user.id}`, values);
        return data.user;
      }
      // Creation is agent-only, so role never travels on the create path.
      const { name, email, password } = values;
      const { data } = await axios.post("/api/users", { name, email, password });
      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      form.reset();
      mutation.reset();
      onSuccess();
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
      className="space-y-4"
      autoComplete="off"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="Full name"
          aria-invalid={!!form.formState.errors.name}
          {...form.register("name")}
        />
        {form.formState.errors.name && (
          <ErrorMessage message={form.formState.errors.name.message} />
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="user@example.com"
          autoComplete="off"
          aria-invalid={!!form.formState.errors.email}
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <ErrorMessage message={form.formState.errors.email.message} />
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder={isEdit ? "Leave blank to keep current" : "Minimum 8 characters"}
          autoComplete="new-password"
          aria-invalid={!!form.formState.errors.password}
          {...form.register("password")}
        />
        {form.formState.errors.password && (
          <ErrorMessage message={form.formState.errors.password.message} />
        )}
      </div>
      {isEdit && (
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select
            value={form.watch("role")}
            onValueChange={(value) => form.setValue("role", value as Role)}
          >
            <SelectTrigger id="role" aria-label="Role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={Role.agent}>{roleLabel[Role.agent]}</SelectItem>
              <SelectItem value={Role.admin}>{roleLabel[Role.admin]}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {mutation.error && (
        <ErrorAlert
          error={mutation.error}
          fallback={`Failed to ${isEdit ? "update" : "create"} user`}
        />
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {isEdit
            ? mutation.isPending ? "Saving..." : "Save Changes"
            : mutation.isPending ? "Creating..." : "Create User"}
        </Button>
      </div>
    </form>
  );
}

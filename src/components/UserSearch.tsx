import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
    id: string;
    email: string;
}

interface UserSearchProps {
    selectedUserIds: string[];
    onUsersChange: (userIds: string[]) => void;
    placeholder?: string;
    excludedUserIds?: string[];
    excludedLabel?: string;
}

export function UserSearch({
    selectedUserIds,
    onUsersChange,
    placeholder = "Search users by email...",
    excludedUserIds = [],
    excludedLabel = "already in opposite list"
}: UserSearchProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<Map<string, string>>(new Map());
    const [isSearching, setIsSearching] = useState(false);

    // Load email addresses for initially selected user IDs
    useEffect(() => {
        if (selectedUserIds.length > 0) {
            loadUserEmails(selectedUserIds);
        }
    }, [selectedUserIds.join(',')]); // Re-run when user IDs change

    const loadUserEmails = async (userIds: string[]) => {
        if (userIds.length === 0) return;

        try {
            const { data, error } = await supabase.functions.invoke('search-users', {
                body: { userIds },
            });

            if (error) throw error;

            if (data?.users) {
                const userMap = new Map(selectedUsers);
                data.users.forEach((u: User) => {
                    userMap.set(u.id, u.email);
                });
                setSelectedUsers(userMap);
            }
        } catch (error) {
            console.error('Error loading user emails:', error);
        }
    };

    const searchUsers = async (query: string) => {
        if (!query || query.trim().length === 0) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const { data, error } = await supabase.functions.invoke('search-users', {
                body: { query, limit: 10 },
            });

            if (error) throw error;

            setSearchResults(data?.users || []);
        } catch (error) {
            console.error('Error searching users:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            searchUsers(searchQuery);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectUser = (user: User) => {
        // Check if user is in excluded list
        if (excludedUserIds.includes(user.id)) {
            return; // Don't allow selection
        }

        if (selectedUserIds.includes(user.id)) {
            // Remove user
            const newUserIds = selectedUserIds.filter(id => id !== user.id);
            const newUsersMap = new Map(selectedUsers);
            newUsersMap.delete(user.id);
            setSelectedUsers(newUsersMap);
            onUsersChange(newUserIds);
        } else {
            // Add user
            const newUserIds = [...selectedUserIds, user.id];
            const newUsersMap = new Map(selectedUsers);
            newUsersMap.set(user.id, user.email);
            setSelectedUsers(newUsersMap);
            onUsersChange(newUserIds);
        }
    };

    const handleRemoveUser = (userId: string) => {
        const newUserIds = selectedUserIds.filter(id => id !== userId);
        const newUsersMap = new Map(selectedUsers);
        newUsersMap.delete(userId);
        setSelectedUsers(newUsersMap);
        onUsersChange(newUserIds);
    };

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        {placeholder}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Type email to search..."
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                        />
                        <CommandList>
                            {isSearching && (
                                <div className="flex items-center justify-center py-6">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                            )}
                            {!isSearching && searchQuery && searchResults.length === 0 && (
                                <CommandEmpty>No users found.</CommandEmpty>
                            )}
                            {!isSearching && searchResults.length > 0 && (
                                <CommandGroup>
                                    {searchResults.map((user) => {
                                        const isExcluded = excludedUserIds.includes(user.id);
                                        const isSelected = selectedUserIds.includes(user.id);

                                        return (
                                            <CommandItem
                                                key={user.id}
                                                value={user.id}
                                                onSelect={() => handleSelectUser(user)}
                                                disabled={isExcluded}
                                                className={cn(isExcluded && "opacity-50 cursor-not-allowed")}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        isSelected ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <div className="flex flex-col flex-1">
                                                    <span>{user.email}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {isExcluded ? `(${excludedLabel})` : user.id}
                                                    </span>
                                                </div>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedUserIds.map((userId) => (
                        <Badge key={userId} variant="secondary" className="gap-1">
                            {selectedUsers.get(userId) || userId}
                            <button
                                onClick={() => handleRemoveUser(userId)}
                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}


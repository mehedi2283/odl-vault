import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { User } from '../types';

export const usePresence = (user: User | null) => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    // 1. Update Database Status (Persistence)
    const updateLastSeen = async () => {
      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };

    updateLastSeen();
    // Heartbeat every 2 minutes to keep "Last Seen" relatively fresh in DB
    const heartbeat = setInterval(updateLastSeen, 2 * 60 * 1000);

    // 2. Realtime Presence (Live Status)
    const channel = supabase.channel('global_presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const userIds = new Set<string>();
        
        for (const key in newState) {
            userIds.add(key);
        }
        
        setOnlineUsers(userIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            user_id: user.id,
          });
        }
      });

    return () => {
      clearInterval(heartbeat);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return onlineUsers;
};
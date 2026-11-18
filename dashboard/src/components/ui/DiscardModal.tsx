"use client";

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

interface DiscardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
}

export function DiscardModal({ isOpen, onClose, onDiscard }: DiscardModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Discard this booking?"
    >
      <div className="p-6 text-muted-foreground text-sm">
        You've entered some details that will be lost if you close now.
      </div>
      <div className="flex items-center justify-end gap-3 p-6 border-t border-border/50 bg-muted/10">
        <Button variant="outline" onClick={onClose} className="border-border">
          Keep Editing
        </Button>
        <Button variant="destructive" onClick={onDiscard} className="bg-red-500/10 text-red-500 hover:bg-red-500/20">
          Discard
        </Button>
      </div>
    </Modal>
  );
}

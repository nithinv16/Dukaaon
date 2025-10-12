import React from 'react';
import { Portal, Dialog, Button, Text } from 'react-native-paper';

interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonColor = '#ff4444',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel}>
        <Dialog.Title>{title || 'Confirmation'}</Dialog.Title>
        <Dialog.Content>
          <Text>{message || 'Are you sure?'}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel}>{cancelText}</Button>
          <Button 
            textColor={confirmButtonColor}
            onPress={onConfirm}
          >
            {confirmText}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
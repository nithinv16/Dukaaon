'use client';

import React, { useState } from 'react';

// Disable static generation for this demo page
export const dynamic = 'force-dynamic';
import {
  Heading,
  Text,
  Label,
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  Card,
  CardHeader,
  CardBody,
  FadeIn,
  SlideIn,
  ScrollReveal,
} from '@/components';

export default function ComponentsDemo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [selectValue, setSelectValue] = useState('');

  const selectOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  return (
    <div className="min-h-screen bg-neutral-light py-12 px-4">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Typography Section */}
        <FadeIn>
          <section className="space-y-6">
            <Heading as="h1" variant="h1">
              Design System Components
            </Heading>
            <Text size="lg" color="secondary">
              A showcase of all available UI components and animations
            </Text>
          </section>
        </FadeIn>

        {/* Typography Examples */}
        <SlideIn direction="up" delay={0.2}>
          <Card>
            <CardHeader>
              <Heading as="h2" variant="h3">
                Typography
              </Heading>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <Heading as="h1" variant="h1">
                  Heading 1
                </Heading>
                <Heading as="h2" variant="h2">
                  Heading 2
                </Heading>
                <Heading as="h3" variant="h3">
                  Heading 3
                </Heading>
                <Heading as="h4" variant="h4">
                  Heading 4
                </Heading>
              </div>
              <div className="space-y-2">
                <Text size="xl" weight="bold">
                  Extra Large Bold Text
                </Text>
                <Text size="lg" weight="medium">
                  Large Medium Text
                </Text>
                <Text size="base">Base Text</Text>
                <Text size="sm" color="secondary">
                  Small Secondary Text
                </Text>
                <Text size="xs" color="muted">
                  Extra Small Muted Text
                </Text>
              </div>
            </CardBody>
          </Card>
        </SlideIn>

        {/* Button Examples */}
        <ScrollReveal direction="up">
          <Card>
            <CardHeader>
              <Heading as="h2" variant="h3">
                Buttons
              </Heading>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <Button variant="primary" size="lg">
                  Primary Large
                </Button>
                <Button variant="primary" size="md">
                  Primary Medium
                </Button>
                <Button variant="primary" size="sm">
                  Primary Small
                </Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="outline">Outline Button</Button>
                <Button variant="primary" disabled>
                  Disabled Button
                </Button>
                <Button variant="primary" isLoading>
                  Loading Button
                </Button>
              </div>
            </CardBody>
          </Card>
        </ScrollReveal>

        {/* Form Components */}
        <ScrollReveal direction="up">
          <Card>
            <CardHeader>
              <Heading as="h2" variant="h3">
                Form Components
              </Heading>
            </CardHeader>
            <CardBody className="space-y-6">
              <div>
                <Label required>Input Field</Label>
                <Input
                  placeholder="Enter text..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helperText="This is a helper text"
                />
              </div>
              <div>
                <Label error>Input with Error</Label>
                <Input placeholder="Enter text..." error="This field is required" />
              </div>
              <div>
                <Label>Textarea</Label>
                <Textarea
                  placeholder="Enter your message..."
                  value={textareaValue}
                  onChange={(e) => setTextareaValue(e.target.value)}
                  rows={4}
                  showCharCount
                  maxCharCount={200}
                />
              </div>
              <div>
                <Label>Select Dropdown</Label>
                <Select
                  options={selectOptions}
                  placeholder="Select an option"
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                />
              </div>
            </CardBody>
          </Card>
        </ScrollReveal>

        {/* Card Examples */}
        <ScrollReveal direction="up">
          <div className="space-y-4">
            <Heading as="h2" variant="h3">
              Card Variants
            </Heading>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card variant="default">
                <CardHeader>
                  <Heading as="h3" variant="h5">
                    Default Card
                  </Heading>
                </CardHeader>
                <CardBody>
                  <Text>This is a default card with shadow.</Text>
                </CardBody>
              </Card>
              <Card variant="elevated">
                <CardHeader>
                  <Heading as="h3" variant="h5">
                    Elevated Card
                  </Heading>
                </CardHeader>
                <CardBody>
                  <Text>This card has more elevation.</Text>
                </CardBody>
              </Card>
              <Card variant="outlined" hoverable>
                <CardHeader>
                  <Heading as="h3" variant="h5">
                    Hoverable Card
                  </Heading>
                </CardHeader>
                <CardBody>
                  <Text>Hover over this card!</Text>
                </CardBody>
              </Card>
            </div>
          </div>
        </ScrollReveal>

        {/* Modal Example */}
        <ScrollReveal direction="up">
          <Card>
            <CardHeader>
              <Heading as="h2" variant="h3">
                Modal
              </Heading>
            </CardHeader>
            <CardBody>
              <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
            </CardBody>
          </Card>
        </ScrollReveal>

        {/* Animation Examples */}
        <ScrollReveal direction="up">
          <Card>
            <CardHeader>
              <Heading as="h2" variant="h3">
                Animation Components
              </Heading>
            </CardHeader>
            <CardBody className="space-y-8">
              <div>
                <Text size="lg" weight="medium" className="mb-4">
                  Scroll down to see animations trigger
                </Text>
              </div>
              <ScrollReveal direction="left">
                <Card variant="outlined">
                  <CardBody>
                    <Text>This card slides in from the left</Text>
                  </CardBody>
                </Card>
              </ScrollReveal>
              <ScrollReveal direction="right">
                <Card variant="outlined">
                  <CardBody>
                    <Text>This card slides in from the right</Text>
                  </CardBody>
                </Card>
              </ScrollReveal>
              <ScrollReveal direction="up">
                <Card variant="outlined">
                  <CardBody>
                    <Text>This card slides in from the bottom</Text>
                  </CardBody>
                </Card>
              </ScrollReveal>
            </CardBody>
          </Card>
        </ScrollReveal>
      </div>

      {/* Modal Component */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Example Modal"
        size="md"
      >
        <div className="space-y-4">
          <Text>This is a modal dialog. You can put any content here.</Text>
          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(false)}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
